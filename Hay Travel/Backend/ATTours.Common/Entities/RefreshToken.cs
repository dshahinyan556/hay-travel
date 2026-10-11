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

        // User-Agent устройства, с которого создана сессия (spec 017 §1) — берётся из
        // RequestContextModel.UserAgent, уже обрезанного до 512 в HttpContextExtensions
        // .BuildRequestContext. Поле чисто аудитное: по нему рисуется список устройств,
        // на логику ротации оно не влияет. Nullable, потому что у строк, созданных до
        // этой миграции, значения нет и бэкфилла не будет.
        public string CreatedByUserAgent { get; set; }

        // Null, пока токен активен. Проставляется при ротации, logout и принудительном отзыве.
        public DateTime? RevokedAtUtc { get; set; }

        // Хеш токена, выданного взамен этого при ротации — нужен для reuse-detection.
        public string ReplacedByTokenHash { get; set; }

        // Выбор «запомнить меня» на момент входа (ADR 029). true -> окно RefreshTokenDays
        // (14д), false -> окно InactivityMinutes (1ч), скользящее по ротации.
        // Копируется при ротации.
        public bool RememberMe { get; set; }

        // Заполнено только у сессии, созданной impersonation'ом: id админа, который вошёл
        // (spec 014 §3.2). Копируется при ротации (RefreshAsync). Null у обычных сессий.
        // Аудит-указатель, не FK (полный аудит — в ImpersonationEvent).
        public int? ImpersonatedByUserId { get; set; }
    }
}
