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

        // Nullable с гибкими ролями (architecture-flexible-roles.md §3.4): Type есть только
        // у 4 системных ролей, у кастомной он null. Фронту для отображения нужен RoleName —
        // enum больше не описывает роль целиком.
        public RoleType? Role { get; set; }
        public string RoleName { get; set; }

        public bool IsEmailVerified { get; set; }
        public bool IsLocked { get; set; }

        // Неприкосновенность аккаунта (SuperAdminGuard, 2026-08-27): раньше этот флаг уходил
        // только в MyPermissionsModel (свой аккаунт) — экран списка/карточки чужого
        // пользователя не мог его прочитать и блокировал действия только по роли
        // (CanManageAdmins), что не эквивалентно. Нужен здесь, чтобы UI мог заранее
        // задизейблить Delete/ForcePasswordReset/ChangeRole/итд для цели-SuperAdmin, а не
        // узнавать о запрете только по 403 с бэкенда.
        public bool IsSuperAdmin { get; set; }

        // Рабочая специализация по умолчанию (Задача D) — попапу назначения исполнителя
        // нужен дефолт прямо из списка сотрудников, без похода за карточкой.
        public EmployeeJobRole? DefaultJobRole { get; set; }

        // Язык писем пользователя (редизайн 2026-08-23). Non-nullable, дефолт Russian.
        public LanguageCode PreferredLanguage { get; set; }
    }
}
