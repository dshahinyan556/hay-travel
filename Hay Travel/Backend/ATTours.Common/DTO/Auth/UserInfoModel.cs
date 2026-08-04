using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Auth
{
    // Публичная проекция пользователя. Пароль, счётчик неудачных входов и точное время
    // блокировки наружу не уходят — только флаг IsLocked.
    public class UserInfoModel
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
    }
}
