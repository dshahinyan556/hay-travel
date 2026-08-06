using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(UserConfiguration))]
    public class User : EntityBase
    {
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }

        // Nullable (B1, 2026-08-06): регистрация больше не требует телефон.
        public string PhoneNumber { get; set; }

        // Односторонний хеш (BCrypt, см. IPasswordHasher/BCryptPasswordHasher).
        public string Password { get; set; }

        // Пока false — вход запрещён (403 EmailNotVerified), даже при верном пароле.
        public bool IsEmailVerified { get; set; }

        public int FailedLoginAttempts { get; set; }

        // UTC. Выставляется по достижении лимита попыток входа; сбрасывается в null
        // при успешном password recovery (вместе с FailedLoginAttempts=0, ForceToChangePass=false).
        public DateTime? LockedUntil { get; set; }

        public bool ForceToChangePass { get; set; }

        // Soft-delete (B4, 2026-08-06): скрывает пользователя из списка/детали (см.
        // UserInfo.GetEntityQueryableRepository) и блокирует Login/Refresh, но не мешает
        // повторной регистрации на тот же email/username — см. filtered unique-индексы (B3).
        public bool IsDeleted { get; set; }

        // UTC. Выставляется один раз в AuthService.RegisterAsync.
        public DateTime RegisteredAtUtc { get; set; }

        // IP регистрации. Nullable: для строк, заведённых до B2, синтетического значения нет.
        public string RegisteredIp { get; set; }

        // UTC. Пишет только UserActivityTrackingService (B7) — по факту авторизованного
        // запроса, троттлится (не чаще раза в 5 минут на пользователя).
        public DateTime? LastActiveAtUtc { get; set; }

        // IP последнего авторизованного запроса (не только логина — имя унаследовано из
        // чек-листа B2/B7, см. заметку в admin-fixes-checklist-2026-08-06.txt). Пишет только
        // UserActivityTrackingService (B7).
        public string LastLoginIp { get; set; }

        public int RoleId { get; set; }
        public UserRole Role { get; set; }

        // Не больше одного активного одноразового токена на UserTokenType (ADR 006):
        // максимум две строки — verify-email и password-reset.
        public ICollection<UserToken> Tokens { get; set; } = [];

        // Живые сессии: по одной строке на устройство/браузер, с ротацией.
        public ICollection<RefreshToken> RefreshTokens { get; set; } = [];

        // Единственный активный флоу смены email (B8, 2026-08-06) — 1:1 опционально,
        // апсертится по UserId в AuthService.RequestEmailChangeAsync.
        public EmailChangeRequest EmailChangeRequest { get; set; }
    }
}
