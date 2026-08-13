using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Чтение правил закрытия для админки: плоская проекция ClosureRule 1:1.
    // Публичный сайт правил не видит — ему отдаётся уже материализованный список
    // закрытых дат (GET api/Availability/GetClosedDates).
    public class ClosureRuleInfoModel
    {
        public int Id { get; set; }
        public int? TourId { get; set; }
        public ClosureRuleType Type { get; set; }
        public ClosureAction Action { get; set; }
        public DateOnly? Date { get; set; }
        public DayOfWeek? DayOfWeek { get; set; }
        public DateOnly? EffectiveFrom { get; set; }
        public DateOnly? EffectiveTo { get; set; }
        public string Reason { get; set; }
    }
}
