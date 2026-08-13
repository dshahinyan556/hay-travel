namespace ATTours.Common.DTO.Request
{
    // Правка брони, пока она не подтверждена (OrderUpdateService отбивает всё, что не
    // PendingConfirmation). TourId сознательно не редактируется — смена тура это другой заказ.
    public class OrderUpdateModel
    {
        public int Id { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
    }
}
