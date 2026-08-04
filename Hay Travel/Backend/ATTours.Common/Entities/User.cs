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

        public int RoleId { get; set; }
        public UserRole Role { get; set; }

        // Не больше одного активного одноразового токена на UserTokenType (ADR 006):
        // максимум две строки — verify-email и password-reset.
        public ICollection<UserToken> Tokens { get; set; } = [];

        // Живые сессии: по одной строке на устройство/браузер, с ротацией.
        public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    }
}
