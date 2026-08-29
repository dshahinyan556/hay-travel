namespace ATTours.Common.Enums
{
    // Управляемые администратором письма заказов (Задача E). Набор закрытый, поэтому enum,
    // а не строковый ключ (в отличие от SiteSetting, где ключи открытые).
    //
    // Auth-письма (verify/reset/email-change) шаблонами НЕ управляются и сюда не входят —
    // это не письма заказов. Смена статуса заказа писем не шлёт вовсе.
    public enum EmailActionKey
    {
        // order.created — админу о новой брони, ждущей подтверждения.
        OrderCreated = 1,

        // order.assign_employee — исполнителю при "Назначить и отправить".
        OrderAssignEmployee = 2,

        // order.unassign_employee — снятому исполнителю.
        OrderUnassignEmployee = 3,

        // order.send_to_client — клиенту, документ заказа вложением.
        OrderSendToClient = 4,

        // order.auto_cancelled — админам о брони, которую фоновая задача отменила сама
        // (не подтверждена до дедлайна). Событие операционное, но заказное: контекст у него
        // тот же Order, поэтому оно живёт в этом же наборе, а не в отдельном диапазоне.
        OrderAutoCancelled = 5
    }
}
