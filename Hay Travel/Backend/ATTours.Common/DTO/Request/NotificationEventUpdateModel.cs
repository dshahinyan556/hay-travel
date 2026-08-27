using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Request
{
    // Сохранение одного события целиком (declarative sync, редизайн 2026-08-23): экран —
    // редактируемый грид с одной кнопкой «Сохранить», а не CRUD-список. Тот же приём,
    // что у UsersController.PutPermissionOverrides.
    public class NotificationEventUpdateModel
    {
        public EmailActionKey EventKey { get; set; }
        public List<NotificationPlatformUpdateModel> Platforms { get; set; } = [];
    }
}
