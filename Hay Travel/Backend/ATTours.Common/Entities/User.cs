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

        // Односторонний хеш (BCrypt — см. docs/user-management.md; пакет ещё не подключён,
        // хеширование появится вместе с login/register).
        public string Password { get; set; }

        public int FailedLoginAttempts { get; set; }

        // UTC. Выставляется по достижении лимита попыток входа; сбрасывается в null
        // при успешном password recovery (вместе с FailedLoginAttempts=0, ForceToChangePass=false).
        public DateTime? LockedUntil { get; set; }

        public bool ForceToChangePass { get; set; }

        public int RoleId { get; set; }
        public UserRole Role { get; set; }

        // Ноль или один активный recovery-запрос — новый перезаписывает старый.
        public PasswordRecovery PasswordRecovery { get; set; }
    }
}
