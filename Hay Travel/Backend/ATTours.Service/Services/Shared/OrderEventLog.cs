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
            [OrderStatus.Completed] = "Выполнен"
        };

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
                    $"Добавлена строка: «{DescribeTour(line.TourTitle)}», {FormatDate(line.TourDate)}, гостей: {line.GuestCount}");
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
                var pickup = string.IsNullOrWhiteSpace(line.PickupDetails) ? "не указано" : "указано";
                var navigator = string.IsNullOrWhiteSpace(line.NavigatorLink) ? "не указан" : "указан";

                await service.WriteAsync(line.OrderId, actorUserId, OrderEventType.LineUpdated,
                    $"Изменена строка «{DescribeTour(line.TourTitle)}», {FormatDate(line.TourDate)}: " +
                    $"предоплата — {prepayment}, место встречи — {pickup}, навигатор — {navigator}");
            });

        // Строки уже нет в БД — данные приходят снапшотом из OrderLineService.RemoveLineAsync.
        public static Task LogLineRemovedAsync(int orderId, int actorUserId, int tourId,
            DateOnly tourDate, int guestCount, CancellationToken cancellationToken)
            => SafeAsync(cancellationToken, async service =>
            {
                var tourTitle = await service.GetTourTitleAsync(tourId);

                await service.WriteAsync(orderId, actorUserId, OrderEventType.LineRemoved,
                    $"Удалена строка: «{DescribeTour(tourTitle)}», {FormatDate(tourDate)}, гостей: {guestCount}");
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
                        : $"Назначен исполнитель {employeeFullName} на строку «{DescribeTour(line.TourTitle)}», {FormatDate(line.TourDate)}";
                }

                await service.WriteAsync(orderId, actorUserId, OrderEventType.EmployeeAssigned, description);
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
                    $"по строке «{DescribeTour(payment.TourTitle)}», {FormatDate(payment.TourDate)}");
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

        private static string FormatDate(DateOnly date) => date.ToString("dd.MM.yyyy", Culture);

        private static string FormatAmount(decimal amount) => amount.ToString("N0", Culture);
    }
}
