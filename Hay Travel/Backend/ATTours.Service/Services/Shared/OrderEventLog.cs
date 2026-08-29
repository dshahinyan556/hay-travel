using ATTours.BusinessServices.Services.CreateServices;
using ATTours.Common.Enums;
using System.Globalization;

namespace ATTours.BusinessServices.Services.Shared
{
    // Единая точка записи журнала заказа (spec 007 / ADR 020). Вызывается из OrderController
    // одной строкой ПОСЛЕ успешной мутации — формулировки, словарь русских статусов и
    // форматирование дат/сумм живут здесь, в бизнес-слое, а не в контроллере.
    //
    // НИ ОДИН метод не бросает наружу: сбой журнала не имеет права откатить уже выполненную
    // операцию заказа (ADR 020 §1) — тот же принцип, что у IEmailSender. Логгера у
    // new-сервисов нет, поэтому ошибка глотается молча; это единственное такое место.
    public static class OrderEventLog
    {
        private static readonly CultureInfo Culture = new("ru-RU");

        // Строки статусов не берутся из enum.ToString(): наружу в журнал едет русский текст,
        // и он не должен молча меняться вместе с переименованием члена enum.
        private static readonly Dictionary<OrderStatus, string> StatusNames = new()
        {
            [OrderStatus.Open] = "Открыт",
            [OrderStatus.Hold] = "На удержании",
            [OrderStatus.Approved] = "Одобрен",
            [OrderStatus.Rejected] = "Отклонён",
            [OrderStatus.ReadyForAssignment] = "Готов к назначению",
            [OrderStatus.PendingPayment] = "Ожидает оплаты",
            [OrderStatus.Completed] = "Выполнен",
            // Кастомная заявка на трансфер (батч 2026-08-29): заказ без цены, пока менеджер
            // не согласует сумму.
            [OrderStatus.Request] = "Заявка"
        };

        // Подпись строки-заявки там, где у обычной строки стоит название тура. Продукта у
        // неё нет, и «—» (fallback пустого названия) в истории читалось бы как потерянные
        // данные, а не как «это кастомный трансфер».
        private const string CustomTransferTitle = "Кастомный трансфер";

        public static Task LogOrderCreatedAsync(int orderId, int actorUserId, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, service =>
                service.WriteAsync(orderId, actorUserId, OrderEventType.Created, "Заказ создан"));

        public static Task LogStatusChangedAsync(int orderId, int actorUserId, OrderStatus previous,
            OrderStatus current, string? rejectReason, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, service =>
            {
                var description = $"Статус изменён: «{DescribeStatus(previous)}» → «{DescribeStatus(current)}»";

                if (current == OrderStatus.Rejected)
                    description += string.IsNullOrWhiteSpace(rejectReason)
                        ? ". Причина отказа не указана"
                        : $". Причина отказа: {rejectReason}";

                return service.WriteAsync(orderId, actorUserId, OrderEventType.StatusChanged, description);
            });

        // Автоотмена фоновой задачей. actorUserId не принимается вовсе (а не передаётся
        // null «на всякий случай»): у планировщика автора нет по определению, и подставить
        // сюда чью-то учётку значило бы соврать в журнале.
        public static Task LogAutoCancelledAsync(int orderId, OrderStatus previous, string reason,
            CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, service =>
                service.WriteAsync(orderId, actorUserId: null, OrderEventType.AutoCancelled,
                    $"Автоотмена: «{DescribeStatus(previous)}» → «{DescribeStatus(OrderStatus.Rejected)}». {reason}"));

        public static Task LogOrderUpdatedAsync(int orderId, int actorUserId, DateOnly previousDate,
            int previousGuestCount, DateOnly currentDate, int currentGuestCount, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, service =>
            {
                var changes = new List<string>();

                if (previousDate != currentDate)
                    changes.Add($"дата {FormatDate(previousDate)} → {FormatDate(currentDate)}");
                if (previousGuestCount != currentGuestCount)
                    changes.Add($"гостей {previousGuestCount} → {currentGuestCount}");

                // Сохранение формы без фактических правок событием не считается — иначе таб
                // «История» забивался бы пустыми строками от повторных Save.
                if (changes.Count == 0)
                    return Task.CompletedTask;

                return service.WriteAsync(orderId, actorUserId, OrderEventType.Updated,
                    $"Изменена бронь: {string.Join(", ", changes)}");
            });

        public static Task LogLineAddedAsync(int lineId, int actorUserId, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, async service =>
            {
                var line = await service.GetLineContextAsync(lineId);
                if (line is null)
                    return;

                await service.WriteAsync(line.OrderId, actorUserId, OrderEventType.LineAdded,
                    $"Добавлена строка: «{DescribeLine(line.LineKind, line.TourTitle)}», {FormatDate(line.TourDate)}, гостей: {line.GuestCount}");
            });

        public static Task LogLineUpdatedAsync(int lineId, int actorUserId, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, async service =>
            {
                var line = await service.GetLineContextAsync(lineId);
                if (line is null)
                    return;

                var prepayment = line.RequiresPrepayment
                    ? $"требуется, {FormatAmount(line.PrepaymentAmount)}"
                    : "не требуется";
                var pickup = line.HasPickupDetails ? "указано" : "не указано";
                var navigator = line.HasNavigatorLink ? "указан" : "не указан";

                // У заявки главное в этой правке — согласованная менеджером цена (решение
                // 0.11), а не место встречи: показываем сумму, иначе история молчала бы ровно
                // про то, ради чего строку и открывали.
                var price = line.LineKind == OrderLineKind.CustomTransfer
                    ? $", цена — {FormatAmount(line.LineTotal)}"
                    : string.Empty;

                await service.WriteAsync(line.OrderId, actorUserId, OrderEventType.LineUpdated,
                    $"Изменена строка «{DescribeLine(line.LineKind, line.TourTitle)}», {FormatDate(line.TourDate)}: " +
                    $"предоплата — {prepayment}, место встречи — {pickup}, навигатор — {navigator}{price}");
            });

        // Строки уже нет в БД — данные приходят снапшотом из OrderLineService.RemoveLineAsync.
        //
        // tourId nullable (2026-08-29): у строки-заявки продукта нет, и запрос названия тура
        // по id 0 нашёл бы пустоту — в историю ушло бы «Удалена строка: «—»». Тип строки
        // приезжает явным полем, а не выводится из отсутствия id.
        public static Task LogLineRemovedAsync(int orderId, int actorUserId, OrderLineKind lineKind, int? tourId,
            DateOnly tourDate, int guestCount, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, async service =>
            {
                var tourTitle = tourId is null ? null : await service.GetTourTitleAsync(tourId.Value);

                await service.WriteAsync(orderId, actorUserId, OrderEventType.LineRemoved,
                    $"Удалена строка: «{DescribeLine(lineKind, tourTitle)}», {FormatDate(tourDate)}, гостей: {guestCount}");
            });

        public static Task LogEmployeeAssignedAsync(int orderId, int actorUserId, string employeeFullName,
            List<int> assignedLineIds, bool allLines, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, async service =>
            {
                string description;

                if (allLines)
                {
                    description = $"Назначен исполнитель {employeeFullName} на все строки заказа ({assignedLineIds.Count})";
                }
                else
                {
                    var line = assignedLineIds.Count == 0 ? null : await service.GetLineContextAsync(assignedLineIds[0]);
                    description = line is null
                        ? $"Назначен исполнитель {employeeFullName}"
                        : $"Назначен исполнитель {employeeFullName} на строку «{DescribeLine(line.LineKind, line.TourTitle)}», {FormatDate(line.TourDate)}";
                }

                await service.WriteAsync(orderId, actorUserId, OrderEventType.EmployeeAssigned, description);
            });

        // Зеркало LogEmployeeAssignedAsync (Задача D). Имя сотрудника приходит снапшотом из
        // OrderUnassignEmployeeService: в строке заказа его уже нет — она обнулена.
        public static Task LogEmployeeUnassignedAsync(int orderId, int actorUserId, string employeeFullName,
            List<int> unassignedLineIds, bool allLines, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, async service =>
            {
                string description;

                if (allLines)
                {
                    description = $"Снят исполнитель {employeeFullName} со всех строк заказа ({unassignedLineIds.Count})";
                }
                else
                {
                    var line = unassignedLineIds.Count == 0 ? null : await service.GetLineContextAsync(unassignedLineIds[0]);
                    description = line is null
                        ? $"Снят исполнитель {employeeFullName}"
                        : $"Снят исполнитель {employeeFullName} со строки «{DescribeLine(line.LineKind, line.TourTitle)}», {FormatDate(line.TourDate)}";
                }

                await service.WriteAsync(orderId, actorUserId, OrderEventType.EmployeeUnassigned, description);
            });

        public static Task LogSentToClientAsync(int orderId, int actorUserId, string? clientEmail, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, service =>
                service.WriteAsync(orderId, actorUserId, OrderEventType.SentToClient,
                    $"Заказ отправлен клиенту на {(string.IsNullOrWhiteSpace(clientEmail) ? "—" : clientEmail)}"));

        public static Task LogPaymentAddedAsync(int paymentId, int actorUserId, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, async service =>
            {
                var payment = await service.GetPaymentContextAsync(paymentId);
                if (payment is null)
                    return;

                var type = payment.Type == OrderPaymentType.Prepayment ? "Предоплата" : "Оплата";

                await service.WriteAsync(payment.OrderId, actorUserId, OrderEventType.PaymentAdded,
                    $"Проведена оплата {payment.Number}: {type} {FormatAmount(payment.Amount)} {payment.Currency} " +
                    $"по строке «{DescribeLine(payment.LineKind, payment.TourTitle)}», {FormatDate(payment.TourDate)}");
            });

        private static async Task SafeAsync(CancellationToken cancellationToken, Func<OrderEventService, Task> write)
        {
            try
            {
                using var service = new OrderEventService(cancellationToken);
                await write(service);
            }
            catch (Exception)
            {
                // ADR 020: журнал — вторичен по отношению к самой операции. Потерянная строка
                // истории дешевле, чем 500 на уже сохранённой смене статуса/назначении.
            }
        }

        private static string DescribeStatus(OrderStatus status)
            => StatusNames.TryGetValue(status, out var name) ? name : status.ToString();

        private static string DescribeTour(string? tourTitle)
            => string.IsNullOrWhiteSpace(tourTitle) ? "—" : tourTitle;

        // Чем подписана строка в истории: названием продукта либо «Кастомный трансфер».
        // Ни одна строка-заявка не должна попасть в журнал как тур — ни под id 0, ни под «—».
        private static string DescribeLine(OrderLineKind lineKind, string? tourTitle)
            => lineKind == OrderLineKind.CustomTransfer ? CustomTransferTitle : DescribeTour(tourTitle);

        private static string FormatDate(DateOnly date) => date.ToString("dd.MM.yyyy", Culture);

        private static string FormatAmount(decimal amount) => amount.ToString("N0", Culture);
    }
}
