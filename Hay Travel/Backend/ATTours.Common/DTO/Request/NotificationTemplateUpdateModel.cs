using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Request
{
    // Тело POST (создание) и PUT (правка) одной записи библиотеки Notification Templates.
    // Одна модель на оба случая: полей одинаково много, а create/update отличаются только
    // наличием Id в маршруте (PUT) — заводить отдельный CreateModel ради этого незачем.
    public class NotificationTemplateUpdateModel
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public NotificationPlatform Channel { get; set; }
        public NotificationTemplateEntity BoundEntity { get; set; }
        public NotificationTemplateTrigger Trigger { get; set; }
        public bool IsActive { get; set; }

        public string Subject { get; set; }
        public string SubjectEn { get; set; }
        public string BodyHtml { get; set; }
        public string BodyHtmlEn { get; set; }
        public string CustomCss { get; set; }
    }
}
