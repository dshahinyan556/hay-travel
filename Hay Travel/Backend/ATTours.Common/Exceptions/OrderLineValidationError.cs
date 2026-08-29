namespace ATTours.Exceptions
{
    // Один пункт пер-строчного отчёта о валидации заказа (ADR 025, развилка Р3): чекаут
    // корзины должен показать, КАКАЯ позиция отклонена и почему, а не один плоский код на
    // весь запрос.
    //
    // ErrorCode здесь int, а не GlobalErrorCode: enum кодов живёт в ATTours.Helper, который
    // сам ссылается на Common — обратная зависимость замкнула бы проекты. Наполняется
    // вызывающим как (int)GlobalErrorCode.X.
    public class OrderLineValidationError
    {
        // 0-based индекс строки в запросе = позиция в корзине на клиенте.
        public int Index { get; set; }

        // Nullable с 2026-08-29: у строки кастомного трансфера продукта нет, и записывать
        // сюда 0 значило бы сообщить о несуществующем «туре №0». Такую строку клиент
        // сопоставляет с позицией только по Index.
        public int? TourId { get; set; }

        public DateOnly TourDate { get; set; }

        public int ErrorCode { get; set; }
    }
}
