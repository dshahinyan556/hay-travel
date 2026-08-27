using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Authorization;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.CreateServices
{
    // Создание кастомной роли: Type = null (стабильный идентификатор есть только у 4
    // сидовых строк, и то лишь ради Employee-эндпоинта, см. UserRole.cs). Матрица прав
    // приходит вместе с ролью и пишется одной транзакцией SaveChanges через Permissions.
    public class RoleCreationService : RepositoryCoreBase<UserRole, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public RoleCreationService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // actingUserId — только чтобы проверить CanManageAdmins (SuperAdmin-only, см. ниже);
        // остальное создание кастомной роли открыто всем с правом roles.Create.
        public async Task<UserRole> CreateAsync(RoleSaveModel model, int actingUserId)
        {
            var name = RolePermissionMatrix.NormalizeName(model.Name);
            var matrix = RolePermissionMatrix.Normalize(model.Permissions);

            // Отбиваем дубль осмысленной ошибкой раньше, чем сработает unique-индекс.
            var nameTaken = await EntityRepository.AsQueryable()
                                                  .AnyAsync(role => role.Name == name, cancellationToken);
            if (nameTaken)
                throw new ErrorModelException(GlobalErrorCode.RoleNameInvalid, HttpStatusCode.BadRequest,
                    $"Role name '{name}' is already taken.");

            // Создание не может дать роли CanManageAdmins/CanImpersonate, если создающий сам
            // не SuperAdmin — иначе кто угодно с roles.Create завёл бы себе новую всесильную
            // роль в обход GuardRoleChange/GuardAdminAccountAsync (та защита сработает только
            // при назначении этой роли пользователю, но замкнуть дыру нужно уже здесь).
            // Один запрос к БД на обе привилегии: они обе SuperAdmin-only.
            if ((model.CanManageAdmins || model.CanImpersonate) && !await IsSuperAdminAsync(actingUserId))
                throw new ErrorModelException(GlobalErrorCode.SuperAdminPrivilegeRequired, HttpStatusCode.Forbidden,
                    "Only a super administrator can grant admin-tier privileges (manage admins / impersonate).");

            var role = new UserRole
            {
                Name = name,
                Type = null,
                CanManageAdmins = model.CanManageAdmins,
                CanImpersonate = model.CanImpersonate
            };

            foreach (var (screenKey, level) in matrix)
            {
                role.Permissions.Add(new RolePermission
                {
                    ScreenKey = screenKey,
                    Level = level
                });
            }

            await EntityRepository.AddAsync(role, cancellationToken);
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
    }
}
