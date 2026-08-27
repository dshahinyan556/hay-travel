namespace ATTours.Common.DTO.Request
{
    // Правка одной строки заказа админом: только предоплата. "Детали для выполнения"
    // (место встречи / навигатор / комментарий) переехали на исполнителя — их правит
    // OrderLineEmployeeUpdateModel (редизайн 2026-08-23).
    //
    // Назначение исполнителя — отдельный эндпоинт (OrderAssignEmployeeModel), т.к. у него
    // своя bulk-логика ("на все строки").
    public class OrderLineUpdateModel
    {
        public int Id { get; set; }
        public bool RequiresPrepayment { get; set; }
        public decimal PrepaymentAmount { get; set; }
    }
}
