using ATTours.Common.DTO.Info;

namespace ATTours.BusinessServices.Notifications
{
    // Всё, что известно о конкретном срабатывании события. Резолверу нужен и заказ (для
    // order-linked получателей), и явный список исполнителей ЭТОГО вызова — из заказа его
    // не вывести: при снятии исполнителей в строках уже нет, а при назначении письмо должно
    // уйти только назначенным сейчас, а не всем, кто был на заказе раньше.
    public class OrderNotificationContext
    {
        public OrderInfoModel? Order { get; set; }

        // Исполнители, к которым относится это событие. Для OrderCreated/OrderSendToClient
        // заполняется сервисом самостоятельно, для Assign/Unassign приходит из результата
        // операции.
        public List<OrderEmployeeRecipient> Employees { get; set; } = [];
    }
}
