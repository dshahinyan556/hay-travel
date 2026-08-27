using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Один исполнитель на одной строке заказа (редизайн 2026-08-23). EmployeeFullName
    // денормализуется мапером из загруженного OrderLineEmployee.Employee.
    //
    // PreferredLanguage сюда сознательно НЕ едет: это внутреннее поле доставки писем,
    // резолвер берёт его из сущности (OrderInfo уже включает Employee в граф).
    public class OrderLineEmployeeInfoModel
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeFullName { get; set; }
        public EmployeeJobRole EmployeeRole { get; set; }
        public string PickupDetails { get; set; }
        public string NavigatorLink { get; set; }
        public string Comment { get; set; }
        public string CommentEn { get; set; }
    }
}
