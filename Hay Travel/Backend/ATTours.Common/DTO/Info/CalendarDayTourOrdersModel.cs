namespace ATTours.Common.DTO.Info
{
    // Занятость одного тура в конкретный день календаря.
    public class CalendarDayTourOrdersModel
    {
        public int TourId { get; set; }
        public int OrderCount { get; set; }
        // Суммарное число гостей по этому туру в этот день.
        public int GuestCount { get; set; }
    }
}
