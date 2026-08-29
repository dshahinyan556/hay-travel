using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Init
{
    // Одна позиция корзины в теле запроса создания заказа (ADR 025 / spec 013).
    //
    // Сознательно НЕ переиспользуем админский OrderLineCreateModel: у него есть OrderId и
    // предоплата (RequiresPrepayment/PrepaymentAmount) — это добавление строки в уже
    // существующий заказ, другой сценарий и другие права. Всё, что определяет деньги и
    // статус, здесь по-прежнему задаёт сервер (OrderCreationService.EnrichAsync).
    //
    // Батч «Трансферы + формат» (2026-08-29): позиция несёт ещё и ВЫБОР клиента — слот,
    // формат и класс авто. Цену по этому выбору по-прежнему считает сервер, из тела запроса
    // никакие суммы не принимаются.
    public class OrderCreateLineModel
    {
        public int TourId { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }

        // Выбранный слот: у тура/экскурсии — одно из Tour.StartTimes (свой ввести нельзя,
        // решение 0.21), у предопределённого трансфера — время подачи, которое вводит клиент.
        // Обязателен и там, и там; nullable только чтобы отличить «не прислали» от 00:00.
        public TimeOnly? StartTime { get; set; }

        // Формат — обязателен ТОЛЬКО когда продукт продаётся в обоих (Tour.Format == Both):
        // от него зависит расчёт цены. При Individual/Group значение игнорируется — формат
        // продукта не переопределяется выбором клиента.
        public TourFormat? Format { get; set; }

        // Обратный рейс — только у трансфера. При IsRoundTrip == true нужны обе даты/времени
        // обратного пути, цена берётся из RoundTripPrice класса (решение 0.6).
        public bool IsRoundTrip { get; set; }
        public DateOnly? ReturnDate { get; set; }
        public TimeOnly? ReturnTime { get; set; }

        // Класс авто — обязателен у предопределённого трансфера (его цена и есть цена
        // строки) и не используется у тура/экскурсии.
        public int? VehicleClassId { get; set; }
    }
}
