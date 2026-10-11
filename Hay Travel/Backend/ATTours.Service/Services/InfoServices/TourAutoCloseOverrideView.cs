namespace ATTours.BusinessServices.Services.InfoServices
{
    // Строка таблицы «Исключения по продуктам» на карточке задачи «Автозакрытие дат».
    // Проекция, а не сущность: экрану нужно название продукта, а оно лежит в переводах
    // (TourInfoTranslation), и тащить ради одной строки весь граф тура незачем.
    //
    // Обычные set-свойства без required/init — тип материализуется прямо в EF-запросе
    // (TourAutoCloseOverrideInfo.GetViewsAsync), и здесь повторён ровно тот приём, что уже
    // работает в проекциях OrderValidationService, а не более строгий из in-memory-view.
    public class TourAutoCloseOverrideView
    {
        public int TourId { get; set; }

        // Русское название продукта, иначе любое имеющееся — то же правило выбора перевода,
        // что в MappingProfile.ResolveTourTitle и OrderEventService.GetTourTitleAsync.
        // Может быть null у продукта вообще без переводов названия (валидация такого не
        // пропускает, но данные старше этой валидации существуют).
        public string? TourName { get; set; }

        public int LeadTimeHours { get; set; }
    }
}
