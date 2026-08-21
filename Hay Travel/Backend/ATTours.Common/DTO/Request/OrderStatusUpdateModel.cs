using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Request
{
    // Смена статуса заказа (заменяет старые Confirm/Cancel — 7 статусов, ADR 019).
    // RejectReason учитывается только когда Status == Rejected, необязательно даже тогда.
    public class OrderStatusUpdateModel
    {
        public int Id { get; set; }
        public OrderStatus Status { get; set; }
        public string RejectReason { get; set; }
    }
}
