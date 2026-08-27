namespace ATTours.Common.Enums
{
    // Откуда берётся адрес получателя. Дискриминатор одной таблицы NotificationRecipient
    // (EF-наследования в кодовой базе нет — ближайший аналог SiteSetting.SettingValueType).
    public enum NotificationRecipientSource
    {
        User = 1,           // конкретный пользователь системы (FK)
        OrderLinked = 2,    // роль, привязанная к заказу (клиент / исполнитель)
        CustomEmail = 3,    // произвольный адрес, введённый руками
        AdminMailbox = 4    // системный ящик из конфигурации (Email:AdminNotificationEmail)
    }
}
