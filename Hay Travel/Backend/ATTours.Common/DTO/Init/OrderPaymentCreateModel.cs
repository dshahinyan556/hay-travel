using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Init
{
    // Ручная проводка (нет платёжного шлюза — админ фиксирует факт оплаты сам, тот же принцип,
    // что и у ADR 014 до переделки). Number(автономер) генерируется на сервере, не принимается.
    public class OrderPaymentCreateModel
    {
        public int OrderLineId { get; set; }
        public OrderPaymentType Type { get; set; }
        public decimal Amount { get; set; }
    }
}
