using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Одна денежная проводка заказа (ADR 019). Собственный Id едет наружу — проводка сама по
    // себе адресуема (грид "платежи" мокапа), в отличие от старого 1:1-снапшота ADR 014.
    public class OrderPaymentInfoModel
    {
        public int Id { get; set; }
        public int OrderLineId { get; set; }
        public OrderPaymentType Type { get; set; }
        public string Number { get; set; }
        public decimal Amount { get; set; }
        public DateTime CreatedAtUtc { get; set; }
    }
}
