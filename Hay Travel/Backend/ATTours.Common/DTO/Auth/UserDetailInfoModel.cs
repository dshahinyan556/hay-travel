using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Auth
{
    // Деталь пользователя (B13, 2026-08-06). Плоский сиблинг UserInfoModel, не наследник —
    // в кодовой базе нет прецедента DTO-наследования (TourCardModel/TourInfoModel тоже
    // сиблинги). Дублирует поля UserInfoModel + 4 новых, доступных только на карточке
    // (IP/активность не должны уходить на клиент при каждой загрузке списка).
    public class UserDetailInfoModel
    {
        public int Id { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
        public string PhoneNumber { get; set; }
        public int RoleId { get; set; }
        public RoleType Role { get; set; }
        public bool IsEmailVerified { get; set; }
        public bool IsLocked { get; set; }

        public DateTime? LastActiveAtUtc { get; set; }
        public DateTime RegisteredAtUtc { get; set; }
        public string RegisteredIp { get; set; }
        public string LastLoginIp { get; set; }
    }
}
