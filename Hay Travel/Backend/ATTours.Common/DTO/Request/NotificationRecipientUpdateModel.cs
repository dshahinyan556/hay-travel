using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Request
{
    public class NotificationRecipientUpdateModel
    {
        // null = новая строка.
        public int? Id { get; set; }

        public bool IsActive { get; set; }
        public NotificationRecipientType? Type { get; set; }
        public NotificationRecipientSource SourceType { get; set; }
        public int? UserId { get; set; }
        public OrderLinkedRecipient? OrderLinkedRole { get; set; }
        public string CustomEmail { get; set; }
        public int SortOrder { get; set; }
    }
}
