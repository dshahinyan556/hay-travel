using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Request
{
    public class NotificationPlatformUpdateModel
    {
        public NotificationPlatform Platform { get; set; }
        public bool IsEnabled { get; set; }

        // Ссылка на шаблон из библиотеки Notification Templates (2026-08-31) — заменяет
        // инлайн Subject/SubjectEn/BodyHtml/BodyHtmlEn. Обязателен, когда IsEnabled = true
        // (у обеих платформ теперь одинаково — раньше Telegram шаблона не имел вовсе).
        public int? TemplateId { get; set; }

        // ПОЛНЫЙ набор строк грида: чего нет в списке — удаляется.
        public List<NotificationRecipientUpdateModel> Recipients { get; set; } = [];
    }
}
