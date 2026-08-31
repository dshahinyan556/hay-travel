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

        // Ссылка на шаблон из библиотеки Notification Templates (2026-08-31). У обеих
        // платформ теперь одинаково устроено — раньше Template был встроен целиком и был
        // null у Telegram. TemplateName/TemplateSubject денормализованы для отображения
        // без похода на второй эндпоинт; полное содержимое — на карточке самого шаблона.
        public int? TemplateId { get; set; }
        public string TemplateName { get; set; }
        public string TemplateSubject { get; set; }

        public List<NotificationRecipientInfoModel> Recipients { get; set; } = [];
    }
}
