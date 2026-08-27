using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Authorization;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Переименование роли + перезапись её матрицы прав. Точечная операция в стиле
    // UserRoleUpdateService: грузим одну строку с Permissions, сверяем, SaveChanges.
    //
    // Никакая роль не защищена от переименования/перезаписи матрицы — сидовые 4 строки
    // редактируются наравне с кастомными (решение Давида 2026-08-22). Единственное
    // исключение — CanManageAdmins: менять именно это поле может только SuperAdmin.
    public class RoleUpdateService : RepositoryCoreBase<UserRole, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public RoleUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task<UserRole> UpdateAsync(int id, RoleSaveModel model, int actingUserId)
        {
            var name = RolePermissionMatrix.NormalizeName(model.Name);
            var matrix = RolePermissionMatrix.Normalize(model.Permissions);

            var role = await EntityRepository.AsQueryable()
                                             .Include(x => x.Permissions)
                                             .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RoleNotFound, HttpStatusCode.NotFound,
                           $"Role with id {id} not found.");

            var nameTaken = await EntityRepository.AsQueryable()
                                                  .AnyAsync(other => other.Name == name && other.Id != id, cancellationToken);
            if (nameTaken)
                throw new ErrorModelException(GlobalErrorCode.RoleNameInvalid, HttpStatusCode.BadRequest,
                    $"Role name '{name}' is already taken.");

            // Менять CanManageAdmins/CanImpersonate (в любую сторону) может только SuperAdmin —
            // если значение реально меняется и вызывающий им не является, отбиваем раньше
            // любой записи. Молчаливо игнорировать нельзя: UI показал бы применённым то,
            // что не применилось.
            var privilegeChanged = model.CanManageAdmins != role.CanManageAdmins
                                   || model.CanImpersonate != role.CanImpersonate;
            if (privilegeChanged && !await IsSuperAdminAsync(actingUserId))
                throw new ErrorModelException(GlobalErrorCode.SuperAdminPrivilegeRequired, HttpStatusCode.Forbidden,
                    "Only a super administrator can change admin-tier privileges (manage admins / impersonate).");

            role.Name = name;
            role.CanManageAdmins = model.CanManageAdmins;
            role.CanImpersonate = model.CanImpersonate;
            ReconcilePermissions(role.Permissions, matrix);

            await EntityRepository.SaveChangesAsync(cancellationToken);

            return role;
        }

        // Читаем из БД, не из claim'а токена — тот же принцип, что у GuardRoleChange/
        // GuardAdminAccountAsync: подделанный/устаревший токен не должен давать прав.
        private async Task<bool> IsSuperAdminAsync(int actingUserId)
        {
            var userRepository = new EntityRepository<User>(Context);
            var actingUser = await userRepository.AsQueryable()
                                                 .SingleOrDefaultAsync(x => x.Id == actingUserId && !x.IsDeleted, cancellationToken);
            return actingUser?.IsSuperAdmin == true;
        }

        // Сверка по ScreenKey (тот же принцип, что у переводов в TagUpdateService): экран,
        // которого нет во входящей матрице, теряет строку прав — PUT перезаписывает матрицу
        // целиком, а не патчит её.
        private static void ReconcilePermissions(ICollection<RolePermission> existing, Dictionary<string, AccessLevel> incoming)
        {
            foreach (var permission in existing.ToList())
            {
                if (permission.ScreenKey is not null && incoming.TryGetValue(permission.ScreenKey, out var level))
                {
                    permission.Level = level;
                    continue;
                }

                existing.Remove(permission);
            }

            var present = new HashSet<string>(
                existing.Where(permission => permission.ScreenKey is not null).Select(permission => permission.ScreenKey),
                StringComparer.OrdinalIgnoreCase);

            foreach (var (screenKey, level) in incoming)
            {
                if (present.Contains(screenKey))
                    continue;

                existing.Add(new RolePermission
                {
                    ScreenKey = screenKey,
                    Level = level
                });
            }
        }
    }
}
