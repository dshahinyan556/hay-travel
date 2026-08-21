namespace ATTours.Common.DTO.Request
{
    // Правка своей брони с публичного сайта, пока заказ ещё не в работе у админа
    // (OrderUpdateService отбивает всё, что не Open/PendingPayment — ADR 019). Id — это
    // Order.Id, не строки: бронь с сайта всегда ровно одна строка, править конкретную строку
    // из грида — отдельный админский эндпоинт (OrderLineUpdateModel). TourId сознательно не
    // редактируется — смена тура это другой заказ.
    public class OrderUpdateModel
    {
        public int Id { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
    }
}
