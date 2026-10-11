namespace ATTours.Common.Enums
{
    // Привязка шаблона к auth-потоку, который его использует (Notification Templates,
    // 2026-08-31). Обычное поле формы, НЕ признак «системного»/защищённого шаблона —
    // Давид явно решил, что эти 4 письма остаются обычными редактируемыми записями.
    // Единственный эффект непустого значения — блокировка удаления, пока оно назначено
    // (см. NotificationTemplateValidationService), и то, что AuthService ищет шаблон
    // именно по этому полю, а не по Id.
    public enum NotificationTemplateTrigger
    {
        None = 0,
        VerifyEmail = 1,
        ResetPassword = 2,
        EmailChangeCode = 3,
        EmailChangeConfirm = 4
    }
}
