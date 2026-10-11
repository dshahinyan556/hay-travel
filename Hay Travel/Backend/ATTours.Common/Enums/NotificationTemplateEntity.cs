namespace ATTours.Common.Enums
{
    // Сущность, чьи поля доступны как мердж-поля (Data Fields) в шаблоне (Notification
    // Templates, 2026-08-31). None — шаблон без динамических полей (например auth-письма,
    // у которых свой фиксированный набор токенов конкретного потока, а не поля сущности).
    public enum NotificationTemplateEntity
    {
        None = 0,
        Order = 1,
        User = 2,
        Tour = 3,
        Employee = 4
    }
}
