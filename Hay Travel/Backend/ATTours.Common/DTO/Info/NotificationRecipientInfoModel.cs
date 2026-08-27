using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Одна строка грида получателей. UserFullName/UserEmail денормализуются мапером
    // из загруженного NotificationRecipient.User — грид показывает их read-only.
    public class NotificationRecipientInfoModel
    {
        public int Id { get; set; }
        public bool IsActive { get; set; }
        public NotificationRecipientType? Type { get; set; }
        public NotificationRecipientSource SourceType { get; set; }

        public int? UserId { get; set; }
        public string UserFullName { get; set; }
        public string UserEmail { get; set; }

        public OrderLinkedRecipient? OrderLinkedRole { get; set; }
        public string CustomEmail { get; set; }
        public int SortOrder { get; set; }
    }
}
