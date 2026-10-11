using ATTours.Common.Entities;
using ATTours.Common.Enums;

namespace ATTours.BusinessServices.Notifications
{
    // Внутренний тип сборки админской проекции «Настройки уведомлений»: событие + каналы +
    // шаблон + получатели одним чтением. Сшивку трёх таблиц делает NotificationSettingsInfo,
    // а не контроллер; маппер разворачивает этот тип в NotificationEventInfoModel.
    public class NotificationEventView
    {
        public EmailActionKey EventKey { get; set; }

        public List<NotificationPlatformView> Platforms { get; set; } = [];
    }

    public class NotificationPlatformView
    {
        public NotificationPlatform Platform { get; set; }

        public bool IsEnabled { get; set; }

        // false у Telegram: канал настраивается, но отправки пока нет.
        public bool IsImplemented { get; set; }

        // Ссылка на шаблон из библиотеки Notification Templates (2026-08-31) — у обеих
        // платформ теперь одинаково, раньше был null у Telegram.
        public int? TemplateId { get; set; }
        public string TemplateName { get; set; }
        public string TemplateSubject { get; set; }

        public List<NotificationRecipient> Recipients { get; set; } = [];
    }
}
