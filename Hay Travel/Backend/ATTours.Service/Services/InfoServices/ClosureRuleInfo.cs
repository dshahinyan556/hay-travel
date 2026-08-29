using ATTours.BusinessServices.Core.Info;
using ATTours.BusinessServices.Services.Availability;
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение правил закрытия. Граф пустой: Tour в правило не включается (ClosureRuleInfoModel
    // несёт только TourId), переводов у правила нет.
    public class ClosureRuleInfo : EntityInfoBase<ClosureRule>
    {
        private readonly CancellationToken cancellationToken;

        public ClosureRuleInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public ClosureRuleInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        public ClosureRuleInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        // Публичный booking-card: плоский список закрытых дат тура в диапазоне.
        // Материализация происходит В ОТВЕТЕ, а не в БД (ADR 012) — в БД лежат правила.
        // Диапазон ограничен окном бронирования (~3 месяца), поэтому проход по дням дёшев.
        //
        // tourId == null — режим «продукта нет»: так спрашивает конструктор кастомного
        // трансфера (решения 0.11/0.27), у которого есть только тип продукта. Тогда
        // применяются глобальные правила и правила этого типа.
        //
        // fallbackTourType используется ТОЛЬКО когда tourId не задан: для существующего
        // продукта тип берётся из БД, а не из запроса — иначе клиент, прислав чужой тип,
        // «открыл» бы себе закрытый день.
        public async Task<List<DateOnly>> GetClosedDatesAsync(int? tourId, DateOnly from, DateOnly to,
            TourType? fallbackTourType = null)
        {
            var closedDates = new List<DateOnly>();
            if (to < from)
                return closedDates;

            var tourType = tourId is null
                ? fallbackTourType
                : await Context.Set<Tour>()
                               .Where(tour => tour.Id == tourId.Value)
                               .Select(tour => (TourType?)tour.Type)
                               .FirstOrDefaultAsync(cancellationToken);

            // Применимые правила = глобальные + правила типа продукта (у обоих TourId == null)
            // + правила этого тура. Отбор конкретных дней делает резолвер: precedence нельзя
            // выразить SQL-фильтром.
            var rules = await GetAllAsync(rule => rule.TourId == null || rule.TourId == tourId);

            // Порог автозакрытия читается ОДИН раз до цикла, а не на каждый день диапазона:
            // это публичный эндпоинт booking-card, и 90 походов в SiteSetting за одним и тем
            // же числом превратили бы дешёвое чтение в дорогое. Тот же контекст — своё
            // соединение info-сервису не нужно, а освобождать чужое ему нельзя.
            var leadTimeHours = await new SiteSettingsInfo(Context, cancellationToken)
                .GetNumberAsync(SiteSettingKeys.BookingAutoCloseLeadTimeHours);

            var nowUtc = DateTime.UtcNow;

            for (var day = from; day <= to; day = day.AddDays(1))
            {
                // Второе слагаемое — тот же живой порог, что и в валидации заказа: фоновая
                // задача материализует правило лишь раз в час, а дата-пикер обязан гасить
                // день сразу, иначе клиент выберет дату, которую бэкенд тут же отвергнет.
                if (ClosureRuleResolver.IsClosed(rules, day, tourId, tourType)
                    || AutoClosureWindow.IsWithinAutoCloseWindow(day, leadTimeHours, nowUtc))
                {
                    closedDates.Add(day);
                }

                // Защита от переполнения на верхней границе DateOnly: AddDays бросил бы
                // ArgumentOutOfRange вместо того, чтобы закончить цикл.
                if (day == DateOnly.MaxValue)
                    break;
            }

            return closedDates;
        }
    }
}
