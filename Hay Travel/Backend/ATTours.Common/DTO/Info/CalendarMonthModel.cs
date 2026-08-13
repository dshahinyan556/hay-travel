namespace ATTours.Common.DTO.Info
{
    // Read-model админ-календаря: месяц целиком, по одному элементу на каждый день.
    // Строится сервисом (OrderCalendarInfo), а не маппером — это не проекция сущности,
    // а результат агрегации заказов и резолва правил закрытия.
    public class CalendarMonthModel
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public List<CalendarDayModel> Days { get; set; } = [];
    }
}
