using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Один день админ-календаря: закрытия (вычислены резолвером, в БД не хранятся — ADR 012)
    // + занятость (агрегат по заказам со Status != Cancelled).
    public class CalendarDayModel
    {
        public DateOnly Date { get; set; }
        // Глобальное правило закрывает этот день для всех туров.
        public bool IsClosedGlobally { get; set; }
        // Причина победившего глобального правила закрытия (B12, 2026-08-13) — null, если
        // день открыт или причина не указывалась. Только для глобального закрытия: у
        // tour-scope правил (ClosedTourIds) своя причина видна в "Правилах", не здесь.
        public string? ClosureReason { get; set; }
        // Туры, закрытые именно в этот день своим (tour-scope) правилом, когда глобально
        // день открыт. Перечисляются только туры, реально фигурирующие в правилах месяца.
        public List<int> ClosedTourIds { get; set; } = [];
        // Типы продукта, закрытые в этот день правилом области «все продукты этого типа»
        // (решение 0.27 — «закрыть только трансферы»), когда глобально день открыт. Отдельно
        // от ClosedTourIds: это правило про КАТЕГОРИЮ, и разворачивать его в список id было
        // бы враньём — продукт, заведённый завтра, тоже попадёт под это закрытие.
        public List<TourType> ClosedTourTypes { get; set; } = [];
        // Сумма OrderCount по OrdersByTour.
        public int TotalOrders { get; set; }
        public List<CalendarDayTourOrdersModel> OrdersByTour { get; set; } = [];
    }
}
