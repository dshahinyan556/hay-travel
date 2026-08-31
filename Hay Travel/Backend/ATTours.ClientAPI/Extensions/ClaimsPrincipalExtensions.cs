using ATTours.Common.Authorization;
using ATTours.Common.Enums;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using ATTours.Helper.Security;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;

namespace ATTours.ClientAPI.Extensions
{
    public static class ClaimsPrincipalExtensions
    {
        // Id пользователя кладётся в claim "sub", но входной маппинг JwtBearer переименовывает
        // его в ClaimTypes.NameIdentifier — проверяем оба, чтобы не зависеть от MapInboundClaims.
        public static int GetUserId(this ClaimsPrincipal principal)
        {
            var rawValue = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                           ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

            if (!int.TryParse(rawValue, out var userId))
                throw new ErrorModelException(GlobalErrorCode.InvalidCredentials, HttpStatusCode.Unauthorized,
                    "Access token does not carry a valid user id.");

            return userId;
        }

        // Небросающий аналог GetUserId — нужен в middleware (B7), где throw недопустим:
        // отсутствие/невалидный claim там означает "пропустить трекинг", а не 401.
        public static bool TryGetUserId(this ClaimsPrincipal principal, out int userId)
        {
            var rawValue = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                           ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

            return int.TryParse(rawValue, out userId);
        }

        // Права запечены в access-токен при его выпуске (architecture-flexible-roles.md §2.6):
        // проверка ничего не читает из БД, только парсит claim "perms". Системный Admin
        // (claim is_admin) проходит мимо матрицы — так новый экран, для которого ещё никому
        // не выданы права, остаётся достижим (deny by default, §2.2).
        public static bool HasPermission(this ClaimsPrincipal principal, string screenKey, PermissionAction action)
        {
            if (principal is null)
                return false;

            if (principal.IsSystemAdmin())
                return true;

            var rawPermissions = principal.FindFirstValue(PermissionClaims.PermissionsClaimType);
            return PermissionClaims.Allowed(PermissionClaims.Parse(rawPermissions), screenKey, action);
        }

        // Claim присутствует только когда true (как is_super_admin) — отсутствие означает
        // «не системный админ», а не «неизвестно».
        public static bool IsSystemAdmin(this ClaimsPrincipal principal)
            => string.Equals(principal?.FindFirstValue(PermissionClaims.IsAdminClaimType),
                             PermissionClaims.TrueValue, StringComparison.OrdinalIgnoreCase);

        // Право «войти как пользователь» (spec 014 §2.3). Та же дисциплина
        // present-only-when-true, что у is_admin/is_super_admin.
        public static bool CanImpersonate(this ClaimsPrincipal principal)
            => string.Equals(principal?.FindFirstValue(PermissionClaims.CanImpersonateClaimType),
                             PermissionClaims.TrueValue, StringComparison.OrdinalIgnoreCase);

        // Мгновенный отзыв access-токена после impersonation (spec 014 §8, ADR 030).
        // Вызывается ТОЛЬКО из permission-атрибутов — не на каждом запросе конвейера.
        public static bool IsAccessTokenRevoked(this ClaimsPrincipal principal,
            IAccessTokenRevocationRegistry registry)
        {
            // Быстрый путь: пока никто не impersonate'ил за последние <=15 мин, реестр пуст —
            // ни sub, ни iat не парсим, стоимость нулевая (ADR 030).
            if (registry is null || registry.IsEmpty)
                return false;

            if (principal is null || !principal.TryGetUserId(out var userId))
                return false;

            // iat обязателен на наших токенах (JwtTokenService кладёт его явно). Если запись
            // для userId живая, а iat непрочитаем — fail-closed (считаем отозванным):
            // отсутствие iat аномально, а приоритет instant-kill выше цены одного лишнего
            // релогина (ADR 030). MinValue < любого Cutoff => «отозван, если запись есть».
            if (!TryGetIssuedAtUtc(principal, out var issuedAtUtc))
                return registry.IsRevoked(userId, DateTime.MinValue);

            return registry.IsRevoked(userId, issuedAtUtc);
        }

        // Мгновенный отзыв ОДНОЙ сессии (David, 2026-08-31) — пара к IsAccessTokenRevoked,
        // но проверяется на КАЖДОМ аутентифицированном запросе (JwtBearerEvents.OnTokenValidated
        // в Startup.cs), не только в permission-атрибутах: у обычного клиента (не staff) их
        // попросту нет на большинстве эндпоинтов, и без общей проверки отзыв сессии из
        // «Активных сеансов» не подействовал бы вовсе.
        public static bool IsSessionRevoked(this ClaimsPrincipal principal, ISessionRevocationRegistry registry)
        {
            if (registry is null || registry.IsEmpty)
                return false;

            var sessionTokenHash = principal?.FindFirstValue("sid");
            if (string.IsNullOrEmpty(sessionTokenHash))
                return false;

            if (!TryGetIssuedAtUtc(principal!, out var issuedAtUtc))
                return registry.IsRevoked(sessionTokenHash, DateTime.MinValue);

            return registry.IsRevoked(sessionTokenHash, issuedAtUtc);
        }

        // iat — unix-секунды. Дефолтный inbound-map JwtBearer timestamp-claim'ы не
        // переименовывает (проверено на выпущенном токене: claim остаётся "iat"), но
        // читаем и по возможному отображённому имени — тот же приём, что в GetUserId,
        // чтобы не зависеть от MapInboundClaims.
        private static bool TryGetIssuedAtUtc(ClaimsPrincipal principal, out DateTime issuedAtUtc)
        {
            issuedAtUtc = default;

            var raw = principal.FindFirstValue(JwtRegisteredClaimNames.Iat);
            if (raw is null && MappedIatClaimType is not null)
                raw = principal.FindFirstValue(MappedIatClaimType);

            if (!long.TryParse(raw, out var unixSeconds))
                return false;

            issuedAtUtc = DateTimeOffset.FromUnixTimeSeconds(unixSeconds).UtcDateTime;
            return true;
        }

        // null, если карта iat не переименовывает (текущее поведение библиотеки).
        private static readonly string? MappedIatClaimType =
            JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.TryGetValue(JwtRegisteredClaimNames.Iat, out var mapped)
                ? mapped
                : null;
    }
}
