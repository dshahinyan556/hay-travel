namespace ATTours.Common.DTO.Info
{
    // Билингвальный шаблон письма. EN-поля могут быть пустыми — тогда письмо англоязычному
    // получателю уходит RU-версией (фолбэк по каждому полю независимо).
    public class NotificationTemplateInfoModel
    {
        public string Subject { get; set; }
        public string SubjectEn { get; set; }
        public string BodyHtml { get; set; }
        public string BodyHtmlEn { get; set; }

        // Уже в фигурных скобках — редактор вставляет строку как есть.
        public List<string> AvailablePlaceholders { get; set; } = [];
    }
}
