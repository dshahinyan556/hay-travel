using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Authorization
{
    // Итог резолва «роль + персональный override» по одному экрану: один уровень доступа
    // (ADR 027), включающий всё, что ниже него.
    public sealed class ResolvedScreenPermission
    {
        public string ScreenKey { get; set; }
        public AccessLevel Level { get; set; }
    }

    // Полный резолвленный набор прав пользователя по ВСЕМ экранам реестра
    // (architecture-flexible-roles.md §2.1). Строит PermissionResolutionService, потребляют
    // JwtTokenService (печёт в claim) и GET api/Auth/MyPermissions.
    public sealed class ResolvedPermissionSet
    {
        // SuperAdmin (User.IsSuperAdmin) — полный доступ мимо матрицы, обновлено 2026-08-22:
        // больше не привязано к RoleType.Admin (ни одна роль не даёт доступ в обход матрицы).
        public bool IsAdmin { get; set; }

        public IReadOnlyList<ResolvedScreenPermission> Screens { get; set; } = [];
    }
}
