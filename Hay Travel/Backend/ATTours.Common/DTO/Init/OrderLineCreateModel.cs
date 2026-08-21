namespace ATTours.Common.DTO.Init
{
    // Админ добавляет строку в уже существующий заказ (мокап: "+ Добавить строку в грид").
    public class OrderLineCreateModel
    {
        public int OrderId { get; set; }
        public int TourId { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
        public bool RequiresPrepayment { get; set; }
        public decimal PrepaymentAmount { get; set; }
    }
}
