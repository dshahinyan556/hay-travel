namespace ATTours.Common.DTO.Request
{
    // Правка одной строки заказа админом: предоплата и "Детали для выполнения" (мокап,
    // Давид 2026-08-16 — текст "где забрать клиента" + ссылка навигатора, per-line).
    // Назначение исполнителя — отдельный эндпоинт (OrderAssignEmployeeModel), т.к. у него
    // своя bulk-логика ("на все строки").
    public class OrderLineUpdateModel
    {
        public int Id { get; set; }
        public bool RequiresPrepayment { get; set; }
        public decimal PrepaymentAmount { get; set; }
        public string PickupDetails { get; set; }
        public string NavigatorLink { get; set; }
    }
}
