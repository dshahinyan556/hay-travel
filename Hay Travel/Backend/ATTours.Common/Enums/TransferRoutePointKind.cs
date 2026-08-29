namespace ATTours.Common.Enums
{
    // Роль точки в маршруте трансфера (батч «Трансферы + формат», 2026-08-29).
    // Одна From и одна To, между ними — сколько угодно Stop; порядок задаёт SortOrder.
    public enum TransferRoutePointKind
    {
        From = 1,
        Stop = 2,
        To = 3
    }
}
