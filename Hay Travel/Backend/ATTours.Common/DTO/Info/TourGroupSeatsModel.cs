using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Остаток мест группового формата за диапазон дат (решения 0.19/0.20 чек-листа
    // checklist-transfers-format-2026-08-29) — публичная read-модель для блока брони на
    // сайте: «осталось N мест» на выбранные дату+время и блокировка кнопки на нуле.
    //
    // Маппер эту модель НЕ строит: это агрегат по строкам заказов, а не проекция сущности —
    // тот же случай, что CalendarMonthModel (её собирает OrderCalendarInfo).
    //
    // Slots содержит ТОЛЬКО слоты, на которых что-то забронировано. Отсутствие даты в списке
    // означает «занято 0, свободно Capacity» — гонять по проводу полную сетку
    // «90 дней x все времена старта», состоящую почти целиком из нулей, незачем.
    public class TourGroupSeatsModel
    {
        public int TourId { get; set; }

        // Формат самого продукта. Individual (или null у продуктов до батча) — мест никто не
        // считает, Capacity будет 0 и Slots пуст: ограничителя у индивидуального формата нет.
        public TourFormat? Format { get; set; }

        // Tour.GroupCapacity — «мест на выезд», ОДНО число на весь продукт; остаток считается
        // на пару (дата + время старта). 0 — мест не задано / формат не групповой.
        public int Capacity { get; set; }

        public List<TourGroupSeatsSlotModel> Slots { get; set; } = [];
    }

    // Занятость одного выезда: дата + время старта.
    public class TourGroupSeatsSlotModel
    {
        public DateOnly Date { get; set; }

        // Сериализуется как "HH:mm:ss" (System.Text.Json, TimeOnly) — как TourStartTimeInfoModel.Time.
        public TimeOnly StartTime { get; set; }

        // Занято = сумма гостей по строкам заказов на этом слоте во всех статусах, кроме
        // Rejected (та же гипотеза, что у админского календаря занятости).
        public int BookedSeats { get; set; }

        public int SeatsLeft { get; set; }
    }
}
