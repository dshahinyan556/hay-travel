namespace ATTours.Common.DTO.Request
{
    // Карточка деталей одного исполнителя на одной строке (OrderFulfillmentTab).
    // Роль здесь НЕ правится — это делает Assign (upsert): переназначение роли и правка
    // деталей это два разных действия, и одно не должно затирать другое.
    public class OrderLineEmployeeUpdateModel
    {
        // Id строки OrderLineEmployee, а не OrderLine.
        public int Id { get; set; }

        public string PickupDetails { get; set; }
        public string NavigatorLink { get; set; }
        public string Comment { get; set; }
        public string CommentEn { get; set; }
    }
}
