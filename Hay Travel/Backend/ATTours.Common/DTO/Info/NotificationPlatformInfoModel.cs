using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Одна платформа доставки внутри события: рубильник + (для Email) шаблон + получатели.
    public class NotificationPlatformInfoModel
    {
        public NotificationPlatform Platform { get; set; }
        public bool IsEnabled { get; set; }

        // false у Telegram: канал настраивается, но отправки пока нет. Фронт этим помечает
        // вкладку, бэкенд — не шлёт.
        public bool IsImplemented { get; set; }

        // Только у Email; у Telegram null.
        public NotificationTemplateInfoModel Template { get; set; }

        public List<NotificationRecipientInfoModel> Recipients { get; set; } = [];
    }
}
