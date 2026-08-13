namespace ATTours.Common.DTO.Init
{
    // Создание брони. Всё, что определяет деньги, статус и владельца заказа, задаётся
    // на сервере (OrderCreationService) и в теле запроса не принимается:
    // UserId берётся из токена, иначе эндпоинт позволял бы оформить бронь на чужой аккаунт.
    public class OrderCreateModel
    {
        public int TourId { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
    }
}
