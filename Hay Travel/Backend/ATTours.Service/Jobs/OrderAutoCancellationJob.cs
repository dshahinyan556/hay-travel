using ATTours.BusinessServices.Notifications;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.Shared;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.Common.Constants;
using ATTours.Common.DTO.Info;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Infrastructure.Time;
using ATTours.Common.Settings;
using AutoMapper;
using Microsoft.Extensions.Logging;

namespace ATTours.BusinessServices.Jobs
{
    // Автоотмена броней, которые никто не подтвердил до дедлайна (план, §7.1).
    //
    // Почему периодический sweep, а не одноразовая отложенная задача на каждый заказ:
    // one-off пришлось бы перепланировать при КАЖДОЙ смене статуса и КАЖДОЙ правке даты
    // тура, а потерянный при рестарте триггер оставил бы заказ висеть навсегда. Sweep
    // выводит истину из БД заново на каждом тике и переживает что угодно.
    //
    // Отсчёт идёт от МИНИМАЛЬНОЙ даты тура в заказе: заказ многострочный (ADR 025), и
    // отменять его надо до того, как наступит самая ранняя из его услуг, а не последняя.
    //
    // Hold не трогается сознательно: это осознанное действие админа («держим, клиент
    // перезвонит»), и робот не имеет права его отменять.
    public class OrderAutoCancellationJob : TourRepositoryCoreBase<Order>, IBackgroundJobHandler
    {
        // Текст уезжает и в Order.RejectReason (его видит клиент в своём заказе), и в
        // журнал заказа. Отдельного перевода нет: RejectReason по всей системе — русская
        // админская строка.
        private const string CancellationReason = "Автоматически отменено: не подтверждено до дедлайна";

        private readonly IOrderNotificationService notificationService;
        private readonly IMapper mapper;
        private readonly ILogger<OrderAutoCancellationJob> logger;

        public OrderAutoCancellationJob(IOrderNotificationService notificationService, IMapper mapper,
            ILogger<OrderAutoCancellationJob> logger)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.notificationService = notificationService;
            this.mapper = mapper;
            this.logger = logger;
        }

        public async Task<JobRunResult> ExecuteAsync(JobExecutionContext context, CancellationToken cancellationToken)
        {
            int deadlineHours;
            int autoCloseLeadTimeHours;

            await using (var settings = new SiteSettingsInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken))
            {
                deadlineHours = await settings.GetNumberAsync(SiteSettingKeys.OrderAutoCancelDeadlineHours);
                autoCloseLeadTimeHours = await settings.GetNumberAsync(SiteSettingKeys.BookingAutoCloseLeadTimeHours);
            }

            // 0 или меньше — «автоотмена выключена». Трактовать это как «отменять всё
            // немедленно» было бы катастрофой от одной опечатки в поле настройки.
            if (deadlineHours <= 0)
                return JobRunResult.Skipped($"Автоотмена выключена: {SiteSettingKeys.OrderAutoCancelDeadlineHours} = {deadlineHours}.");

            // Инвариант из плана (§6): дедлайн отмены обязан быть строго меньше порога
            // автозакрытия дня. Иначе бронь, оформленная в последний разрешённый час,
            // попадала бы под автоотмену в тот же момент, когда её создали, — и клиент
            // получал бы отказ на только что оплаченное намерение.
            //
            // Skipped, а не Failed и не «работаем как получится»: конфигурация противоречива,
            // это чинится в админке, а прогон обязан объяснить, почему ничего не сделал.
            if (deadlineHours >= autoCloseLeadTimeHours)
            {
                return JobRunResult.Skipped(
                    $"Противоречивая настройка: {SiteSettingKeys.OrderAutoCancelDeadlineHours} = {deadlineHours} ч " +
                    $"не меньше {SiteSettingKeys.BookingAutoCloseLeadTimeHours} = {autoCloseLeadTimeHours} ч. " +
                    "Заказы не отменялись.");
            }

            var nowUtc = DateTime.UtcNow;

            // Дедлайн заказа — «начало дня тура (по Армении) минус deadlineHours». Переносим
            // сравнение из времени в даты, чтобы условие переводилось в SQL: заказ просрочен
            // ⟺ его минимальная дата тура не позже того дня, который идёт в Армении через
            // deadlineHours. Секундная точность здесь не нужна — шаг задачи 15 минут.
            var latestDueDate = ArmeniaTimeZone.TodayInArmenia(nowUtc.AddHours(deadlineHours));

            // min(TourDate) <= latestDueDate ⟺ существует строка с TourDate <= latestDueDate.
            // Записанное через Any условие переводится в обычный EXISTS, в отличие от Min()
            // по навигации.
            var candidateIds = await EntityRepository.AsQueryable()
                .AsNoTracking()
                .Where(order => (order.Status == OrderStatus.Open || order.Status == OrderStatus.PendingPayment)
                                && order.Lines.Any(line => line.TourDate <= latestDueDate))
                .Select(order => order.Id)
                .ToListAsync(cancellationToken);

            if (candidateIds.Count == 0)
                return JobRunResult.Succeeded(0, "Просроченных неподтверждённых заказов нет.");

            var cancelled = 0;

            foreach (var orderId in candidateIds)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (await CancelAsync(orderId, context, cancellationToken))
                    cancelled++;
            }

            return JobRunResult.Succeeded(cancelled,
                $"Проверено заказов: {candidateIds.Count}, отменено: {cancelled} " +
                $"(дедлайн {deadlineHours} ч, крайняя дата тура {latestDueDate:dd.MM.yyyy}).");
        }

        // true = заказ действительно отменён. Ошибка на одном заказе не срывает прогон:
        // остальные просроченные брони обязаны быть обработаны, а инцидент виден как
        // предупреждение в истории прогонов.
        private async Task<bool> CancelAsync(int orderId, JobExecutionContext context, CancellationToken cancellationToken)
        {
            try
            {
                // Повторная проверка статуса вплотную к мутации. Между сканом и этой строкой
                // админ мог одобрить заказ вручную — SetStatusAsync выставляет статус
                // безусловно, и без этой проверки робот затёр бы человеческое решение.
                var currentStatus = await EntityRepository.AsQueryable()
                    .AsNoTracking()
                    .Where(order => order.Id == orderId)
                    .Select(order => order.Status)
                    .FirstOrDefaultAsync(cancellationToken);

                if (currentStatus is not (OrderStatus.Open or OrderStatus.PendingPayment))
                    return false;

                OrderStatusChangeResult change;
                using (var statusService = new OrderStatusService(cancellationToken))
                    change = await statusService.SetStatusAsync(orderId, OrderStatus.Rejected, CancellationReason);

                // Журнал — отдельным типом события (AutoCancelled), а не StatusChanged:
                // у действия нет автора, и в истории заказа это должно быть видно сразу.
                // Сам OrderEventLog никогда не бросает (ADR 020).
                await OrderEventLog.LogAutoCancelledAsync(orderId, change.PreviousStatus, CancellationReason,
                    cancellationToken);

                await NotifyAsync(orderId, cancellationToken);

                return true;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                // Остановка приложения — не сбой заказа, разбирать её должен раннер.
                throw;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Автоотмена заказа {OrderId} не удалась.", orderId);
                context.AddWarning($"заказ {orderId}: {exception.Message}");
                return false;
            }
        }

        // Перечитываем заказ целиком: письму нужны денормализованные поля (клиент, туры,
        // даты), которых у одного Id нет. Уже уехавшая смена статуса от сбоя уведомления
        // не откатывается — тот же принцип, что у контроллера заказов.
        private async Task NotifyAsync(int orderId, CancellationToken cancellationToken)
        {
            await using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var order = await info.GetByIdAsync(orderId, cancellationToken);

            if (order is null)
                return;

            await notificationService.SendOrderAutoCancelledAsync(mapper.Map<OrderInfoModel>(order), cancellationToken);
        }
    }
}
