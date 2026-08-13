namespace ATTours.Common.DTO.Info
{
    // Денежная часть заказа (ADR 014). Плоская проекция OrderPayment: собственный Id
    // наружу не едет — платёж адресуется только через заказ.
    public class OrderPaymentInfoModel
    {
        public decimal TourPriceSnapshot { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal PrepaidAmount { get; set; }
        public string Currency { get; set; }
    }
}
