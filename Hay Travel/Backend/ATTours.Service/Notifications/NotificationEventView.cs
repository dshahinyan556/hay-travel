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

        // null у Telegram — шаблона письма у него нет вовсе.
        public EmailTemplate? Template { get; set; }

        public List<NotificationRecipient> Recipients { get; set; } = [];
    }
}
