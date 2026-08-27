using ArmeniaTours.DataLayer;
using ATTours.Common.Authorization;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;

namespace ATTours.BusinessServices.Services.Authorization
{
    // ЕДИНСТВЕННОЕ место резолва «роль + персональный override -> итоговый набор прав»
    // (architecture-flexible-roles.md §2.1, §2.2). Вызывается только при выпуске
    // access-токена (login/dev-login/refresh) и из GET api/Auth/MyPermissions — на каждый
    // запрос БД не трогается, enforcement идёт по claim'у (§0.2).
    //
    // Итерация всегда по реестру AdminScreens.All, а не по строкам БД: новый экран
    // появляется в наборе автоматически, а осиротевшие строки с исчезнувшим ключом просто
    // игнорируются (§5).
    public class PermissionResolutionService : RepositoryCoreBase<UserRole, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public PermissionResolutionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public PermissionResolutionService(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context)
        {
            this.cancellationToken = cancellationToken;
        }

        private IEntityRepository<RolePermission>? rolePermissionRepository;
        private IEntityRepository<RolePermission> RolePermissionRepository
            => rolePermissionRepository ??= new EntityRepository<RolePermission>(Context);

        private IEntityRepository<UserPermissionOverride>? overrideRepository;
        private IEntityRepository<UserPermissionOverride> OverrideRepository
            => overrideRepository ??= new EntityRepository<UserPermissionOverride>(Context);

        // isSuperAdmin приходит из уже загруженного user.IsSuperAdmin — так шорткат
        // отрабатывает без единого запроса к таблицам прав. Никакая роль (в т.ч. сидовая
        // «Администратор») больше не даёт доступ в обход матрицы — решение Давида
        // 2026-08-22: роль это данные, а не привилегия, зашитая в код.
        public async Task<ResolvedPermissionSet> ResolveAsync(int userId, int roleId, bool isSuperAdmin)
        {
            // SuperAdmin получает всё безусловно: именно это делает новый экран без строк
            // в БД видимым SuperAdmin'у и никому больше (deny by default, решение 5) — без
            // этого шортката только что заведённый экран был бы недостижим вообще всем,
            // пока кто-нибудь вручную не проставит права хоть одной роли.
            if (isSuperAdmin)
                return BuildSuperAdminSet();

            var rolePermissions = await RolePermissionRepository.AsQueryable()
                                                                .AsNoTracking()
                                                                .Where(permission => permission.RoleId == roleId)
                                                                .ToListAsync(cancellationToken);

            var overrides = await OverrideRepository.AsQueryable()
                                                    .AsNoTracking()
                                                    .Where(permissionOverride => permissionOverride.UserId == userId)
                                                    .ToListAsync(cancellationToken);

            var roleByScreen = ToDictionary(rolePermissions, permission => permission.ScreenKey);
            var overrideByScreen = ToDictionary(overrides, permissionOverride => permissionOverride.ScreenKey);

            var screens = new List<ResolvedScreenPermission>(AdminScreens.All.Count);

            foreach (var definition in AdminScreens.All)
            {
                var fromRole = roleByScreen.GetValueOrDefault(definition.Key);
                var fromOverride = overrideByScreen.GetValueOrDefault(definition.Key);

                // Override перекрывает роль целиком и в обе стороны; null — берём роль,
                // нет строки роли — None (ADR 027).
                var raw = fromOverride?.Level ?? fromRole?.Level ?? AccessLevel.None;

                screens.Add(new ResolvedScreenPermission
                {
                    ScreenKey = definition.Key,
                    // Защитная обрезка до применимого к экрану действия, чем бы уровень ни
                    // был выставлен в БД (нельзя выдать Create у catalog.regions).
                    Level = AdminScreens.CapLevel(definition.Key, raw)
                });
            }

            return new ResolvedPermissionSet { IsAdmin = false, Screens = screens };
        }

        // Максимум, применимый к экрану: CapLevel(Delete) снимает уровень до наивысшего
        // действия из реестра (у catalog.regions это Update, у dashboard — View).
        private static ResolvedPermissionSet BuildSuperAdminSet()
        {
            var screens = AdminScreens.All
                .Select(definition => new ResolvedScreenPermission
                {
                    ScreenKey = definition.Key,
                    Level = AdminScreens.CapLevel(definition.Key, AccessLevel.Delete)
                })
                .ToList();

            return new ResolvedPermissionSet { IsAdmin = true, Screens = screens };
        }

        // Уникальный индекс (RoleId/UserId, ScreenKey) дубль исключает, но словарь строим
        // терпимо к нему: резолв прав не должен падать из-за грязной строки в БД.
        private static Dictionary<string, TItem> ToDictionary<TItem>(List<TItem> items, Func<TItem, string> keySelector)
        {
            var result = new Dictionary<string, TItem>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in items)
            {
                var key = keySelector(item);
                if (key is not null)
                    result[key] = item;
            }

            return result;
        }
    }
}
