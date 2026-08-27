using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Одно событие целиком — то, что открывается по клику на строку грида «Событие»
    // (редизайн 2026-08-23). DisplayName приходит из код-реестра EmailPlaceholders.
    public class NotificationEventInfoModel
    {
        public EmailActionKey EventKey { get; set; }
        public string DisplayName { get; set; }
        public List<NotificationPlatformInfoModel> Platforms { get; set; } = [];
    }
}
