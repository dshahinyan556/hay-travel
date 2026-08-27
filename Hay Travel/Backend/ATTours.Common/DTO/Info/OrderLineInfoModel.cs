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

        // Исполнители строки (0..N, редизайн 2026-08-23). Пустой список — строка не назначена.
        // Роль и "детали для выполнения" живут на каждом исполнителе отдельно.
        public List<OrderLineEmployeeInfoModel> Employees { get; set; } = [];

        public List<OrderPaymentInfoModel> Payments { get; set; } = [];
    }
}
