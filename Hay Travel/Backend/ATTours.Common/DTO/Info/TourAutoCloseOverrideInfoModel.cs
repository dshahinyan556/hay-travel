namespace ATTours.Common.DTO.Info
{
    // Строка таблицы «Исключения по продуктам» на карточке задачи «Автозакрытие дат»
    // (батч 2026-08-29): у этого продукта свой порог, отличный от глобального
    // booking.autoCloseLeadTimeHours.
    public class TourAutoCloseOverrideInfoModel
    {
        // Идентичность строки — продукт, а не Id таблицы: экран правит «порог такого-то
        // продукта», а PUT заменяет набор целиком, и Id строки ему не нужен ни для чего.
        public int TourId { get; set; }

        // Название продукта read-only: подпись строки, чтобы экран не тянул каталог туров
        // отдельным запросом ради трёх исключений. Русское, иначе любое имеющееся.
        public string TourName { get; set; }

        public int LeadTimeHours { get; set; }
    }
}
