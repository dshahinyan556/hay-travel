using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Смена статуса заказа (ADR 019 — заменяет OrderConfirmationService/
    // OrderCancellationService, 3 статуса выросли в 7). Сознательно НЕ строгий конечный
    // автомат: статус в UI — обычный дропдаун (мокап Давида, "status field disabled
    // everytime" значит "не текстом", не "по жёсткому графу переходов"), любой статус можно
    // выставить из любого. Единственное настоящее правило — RejectReason имеет смысл только
    // при Rejected и очищается при уходе с него.
    public class OrderStatusService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderStatusService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // Возвращает «было/стало»: предыдущий статус нужен журналу заказа (spec 007), а знать
        // его может только тот, кто читал сущность до записи. Тот же приём, что у
        // OrderAssignEmployeeResult — сервис отдаёт наружу контекст, а не заставляет
        // контроллер делать лишний запрос.
        public async Task<OrderStatusChangeResult> SetStatusAsync(int id, OrderStatus status, string rejectReason)
        {
            var order = await EntityRepository.AsQueryable()
                                              .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {id} not found.");

            var previousStatus = order.Status;

            order.Status = status;
            order.RejectReason = status == OrderStatus.Rejected ? rejectReason : null;

            if (status == OrderStatus.Approved && order.ApprovedAtUtc is null)
                order.ApprovedAtUtc = DateTime.UtcNow;

            await EntityRepository.SaveChangesAsync(cancellationToken);

            return new OrderStatusChangeResult
            {
                PreviousStatus = previousStatus,
                CurrentStatus = order.Status,
                RejectReason = order.RejectReason
            };
        }
    }

    public class OrderStatusChangeResult
    {
        public OrderStatus PreviousStatus { get; set; }
        public OrderStatus CurrentStatus { get; set; }
        public string? RejectReason { get; set; }
    }
}
