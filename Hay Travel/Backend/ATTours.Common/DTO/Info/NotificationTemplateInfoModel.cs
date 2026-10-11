using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Одна запись библиотеки Notification Templates (2026-08-31, экран /admin/notification-
    // templates) — открытый CRUD, заменяет удалённый EmailTemplate (был жёстко привязан
    // 1:1 к EmailActionKey, только Email). EN-поля могут быть пустыми — тогда рендер
    // англоязычному получателю уходит RU-версией (фолбэк по каждому полю независимо).
    public class NotificationTemplateInfoModel
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public NotificationPlatform Channel { get; set; }
        public NotificationTemplateEntity BoundEntity { get; set; }
        public NotificationTemplateTrigger Trigger { get; set; }
        public bool IsActive { get; set; }

        // Только у Channel.Email — у Telegram нет темы письма.
        public string Subject { get; set; }
        public string SubjectEn { get; set; }
        public string BodyHtml { get; set; }
        public string BodyHtmlEn { get; set; }

        // Только у Channel.Email (решение 2026-08-31: JS не делаем вообще).
        public string CustomCss { get; set; }

        // Уже в фигурных скобках — редактор вставляет строку как есть. Каталог — по
        // BoundEntity (EmailPlaceholders.ForEntity), не по конкретному событию: шаблон
        // переиспользуем, событие-потребитель заранее не известно.
        public List<string> AvailablePlaceholders { get; set; } = [];

        // Read-only производная: где шаблон сейчас назначен. Тот же список используется
        // для блокировки удаления (NotificationTemplateValidationService) — не дублировать.
        public List<NotificationTemplateUsageInfoModel> Usages { get; set; } = [];
    }

    // Один пункт «Используется в»: либо событие+платформа «Настроек уведомлений» (EventKey
    // задан — фронт строит и текст, и ссылку на /admin/notifications/{eventKey} из своих
    // билингвальных copy-словарей, как и остальные подписи енамов в проекте — см. ADR 021,
    // adminEnumsCopy.emailActionKey/notificationPlatform), либо auth-триггер (EventKey null,
    // Trigger задан — ссылаться некуда, отдельного экрана-события у auth-писем нет).
    // Структурные данные, не готовая строка: бэкенд не решает, на каком языке её показывать.
    public class NotificationTemplateUsageInfoModel
    {
        public EmailActionKey? EventKey { get; set; }
        public NotificationPlatform? Platform { get; set; }
        public NotificationTemplateTrigger? Trigger { get; set; }
    }
}
