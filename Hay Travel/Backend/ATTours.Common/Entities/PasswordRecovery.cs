using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(PasswordRecoveryConfiguration))]
    public class PasswordRecovery : EntityBase
    {
        public int UserId { get; set; }
        public User User { get; set; }

        public string Token { get; set; }
        public DateTime RequestedAtUtc { get; set; }
        public string RequestIp { get; set; }
        public string UserAgent { get; set; }
        public DateTime ExpiresAtUtc { get; set; }

        // Null, пока не использован. Успешное использование сбрасывает User.FailedLoginAttempts,
        // User.LockedUntil и User.ForceToChangePass.
        public DateTime? UsedAtUtc { get; set; }
    }
}
