using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Долгоживущий refresh-токен сессии (ADR 006). Живёт отдельно от UserToken, потому что
    // токенов у пользователя может быть несколько одновременно (разные устройства),
    // они ротируются и образуют цепочку замены.
    // В БД хранится только SHA-256 хеш, plaintext уходит клиенту в httpOnly-cookie.
    [EntityTypeConfiguration(typeof(RefreshTokenConfiguration))]
    public class RefreshToken : EntityBase
    {
        public int UserId { get; set; }
        public User User { get; set; }

        public string TokenHash { get; set; }

        public DateTime ExpiresAtUtc { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public string CreatedByIp { get; set; }

        // Null, пока токен активен. Проставляется при ротации, logout и принудительном отзыве.
        public DateTime? RevokedAtUtc { get; set; }

        // Хеш токена, выданного взамен этого при ротации — нужен для reuse-detection.
        public string ReplacedByTokenHash { get; set; }
    }
}
