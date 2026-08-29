using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Init
{
    // Создание правила закрытия. Той же моделью идёт и массовое закрытие/открытие —
    // эндпоинт принимает список (правила дёшевы, редактирования нет: изменить = удалить и создать).
    public class ClosureRuleCreateModel
    {
        // null = глобальное правило (все туры).
        public int? TourId { get; set; }
        // null = правило не привязано к типу продукта. Заполнено = правило закрывает/
        // открывает ВСЕ продукты этого типа (решение 0.27, «закрыть только трансферы»).
        // Вместе с TourId не принимается: правило либо про один продукт, либо про тип.
        public TourType? TourType { get; set; }
        public ClosureRuleType Type { get; set; }
        public ClosureAction Action { get; set; }
        // Обязательно при Type == SpecificDate.
        public DateOnly? Date { get; set; }
        // Обязательно при Type == Weekly (System.DayOfWeek: Sunday=0..Saturday=6).
        public DayOfWeek? DayOfWeek { get; set; }
        public DateOnly? EffectiveFrom { get; set; }
        public DateOnly? EffectiveTo { get; set; }
        public string Reason { get; set; }
    }
}
