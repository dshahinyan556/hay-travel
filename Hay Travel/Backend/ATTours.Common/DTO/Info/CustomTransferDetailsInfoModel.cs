using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Детали кастомной заявки в ответе заказа (батч «Трансферы + формат», 2026-08-29):
    // блок «Запрос» на экране заказа в админке (пункт 4.5 чек-листа) и экран результата
    // заявки на сайте читают одну и ту же модель.
    //
    // Дата/время подачи, обратный рейс и число гостей здесь НЕ дублируются — они на самой
    // строке (OrderLineInfoModel), как и у обычной брони.
    public class CustomTransferDetailsInfoModel
    {
        public int Id { get; set; }

        public int PassengerCount { get; set; }

        public int LuggageMediumCount { get; set; }
        public int LuggageLargeCount { get; set; }
        public string LuggageOther { get; set; }

        // Багаж в «единицах» по курсу решения 0.13 (средний = 3, большой = 5) — считает
        // сервер, чтобы админка и конструктор не пересчитывали его каждый по-своему.
        public int LuggageUnits { get; set; }

        // Пожелание клиента, а не бронь класса. Название денормализовано, чтобы экран заказа
        // не ходил в справочник отдельным запросом (тот же приём, что TourTitle на строке).
        public int? DesiredVehicleClassId { get; set; }
        public string DesiredVehicleClassName { get; set; }

        public string Comment { get; set; }

        // Маршрут в порядке From -> Stop(SortOrder) -> To.
        public List<CustomTransferStopInfoModel> Stops { get; set; } = [];
    }

    public class CustomTransferStopInfoModel
    {
        public int Id { get; set; }
        public TransferRoutePointKind Kind { get; set; }
        public int SortOrder { get; set; }
        public string Text { get; set; }
    }
}
