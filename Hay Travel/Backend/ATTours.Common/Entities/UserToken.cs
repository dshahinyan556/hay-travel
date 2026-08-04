using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Одноразовый email-токен (ADR 006). Раньше — PasswordRecovery; обобщён полем Type,
    // чтобы verify-email и password-reset жили по одному механизму.
    // Не больше одного активного токена на пару (UserId, Type): новый перезаписывает старый.
    [EntityTypeConfiguration(typeof(UserTokenConfiguration))]
    public class UserToken : EntityBase
    {
        public int UserId { get; set; }
        public User User { get; set; }

        public UserTokenType Type { get; set; }

        public string Token { get; set; }
        public DateTime RequestedAtUtc { get; set; }
        public string RequestIp { get; set; }
        public string UserAgent { get; set; }
        public DateTime ExpiresAtUtc { get; set; }

        // Null, пока не использован. Успешное использование PasswordReset-токена сбрасывает
        // User.FailedLoginAttempts, User.LockedUntil и User.ForceToChangePass.
        public DateTime? UsedAtUtc { get; set; }
    }
}
