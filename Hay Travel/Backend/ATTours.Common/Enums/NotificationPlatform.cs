namespace ATTours.Common.Enums
{
    // Канал доставки уведомления. Telegram в этой задаче — только модель и настройки:
    // реальной отправки нет (OrderNotificationService обрабатывает только Email).
    public enum NotificationPlatform
    {
        Email = 1,
        Telegram = 2
    }
}
