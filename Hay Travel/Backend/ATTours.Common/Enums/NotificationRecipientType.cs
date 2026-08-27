namespace ATTours.Common.Enums
{
    // Роль адреса в письме. Только для Email: у Telegram копий/скрытых копий не бывает.
    public enum NotificationRecipientType
    {
        To = 1,
        Cc = 2,
        Bcc = 3
    }
}
