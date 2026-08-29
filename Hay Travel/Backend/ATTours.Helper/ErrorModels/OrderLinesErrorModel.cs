namespace ATTours.Helper.ErrorModels
{
    // Ответ 400 на отказ валидации мульти-строчного заказа (ADR 025 / spec 013 §3).
    // Расширяет обычный ErrorModel: плоский ErrorCode (2031, OrderHasInvalidLines) остаётся
    // на месте для клиентов, читающих только его, а Lines несёт причину по каждой позиции.
    public class OrderLinesErrorModel : ErrorModel
    {
        public List<OrderLineErrorItem> Lines { get; set; } = [];
    }

    // Index — 0-based позиция строки в запросе (= позиция в корзине); фронт сопоставляет
    // ошибку с позицией по нему либо по паре TourId+TourDate.
    //
    // TourId nullable с 2026-08-29: строка без продукта (кастомный трансфер) сопоставляется
    // только по Index. В чекауте корзины таких строк не бывает — она шлёт только продукты.
    public class OrderLineErrorItem
    {
        public int Index { get; set; }
        public int? TourId { get; set; }
        public DateOnly TourDate { get; set; }
        public int ErrorCode { get; set; }
    }
}
