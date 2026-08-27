namespace ATTours.Common.DTO.Init
{
    // Одна позиция корзины в теле запроса создания заказа (ADR 025 / spec 013).
    //
    // Сознательно НЕ переиспользуем админский OrderLineCreateModel: у него есть OrderId и
    // предоплата (RequiresPrepayment/PrepaymentAmount) — это добавление строки в уже
    // существующий заказ, другой сценарий и другие права. Всё, что определяет деньги и
    // статус, здесь по-прежнему задаёт сервер (OrderCreationService.EnrichAsync).
    public class OrderCreateLineModel
    {
        public int TourId { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
    }
}
