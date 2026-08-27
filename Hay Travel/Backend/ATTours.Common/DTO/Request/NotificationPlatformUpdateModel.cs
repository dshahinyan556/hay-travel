using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Request
{
    public class NotificationPlatformUpdateModel
    {
        public NotificationPlatform Platform { get; set; }
        public bool IsEnabled { get; set; }

        // Только для Email; для Telegram игнорируются. BodyHtml/BodyHtmlEn приходят от
        // WYSIWYG-редактора и санитизируются на сохранении одинаково (ADR 026).
        public string Subject { get; set; }
        public string SubjectEn { get; set; }
        public string BodyHtml { get; set; }
        public string BodyHtmlEn { get; set; }

        // ПОЛНЫЙ набор строк грида: чего нет в списке — удаляется.
        public List<NotificationRecipientUpdateModel> Recipients { get; set; } = [];
    }
}
