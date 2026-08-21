namespace ATTours.Common.DTO.Info
{
    // Одна строка заказа. TourTitle денормализован (как TourTitle раньше был на OrderInfoModel
    // напрямую) — список заказов и деталь заказа не должны тянуть граф тура отдельным запросом.
    public class OrderLineInfoModel
    {
        public int Id { get; set; }
        public int TourId { get; set; }
        public string TourTitle { get; set; }
        public string TourMainImageUrl { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }

        public bool RequiresPrepayment { get; set; }
        public decimal PrepaymentAmount { get; set; }

        public decimal PriceSnapshot { get; set; }
        public decimal? DiscountPercent { get; set; }
        public decimal LineTotal { get; set; }

        public int? EmployeeId { get; set; }
        public string EmployeeFullName { get; set; }

        public string PickupDetails { get; set; }
        public string NavigatorLink { get; set; }

        public List<OrderPaymentInfoModel> Payments { get; set; } = [];
    }
}
