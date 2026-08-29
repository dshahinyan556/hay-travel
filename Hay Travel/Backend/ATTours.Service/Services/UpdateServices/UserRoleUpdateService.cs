using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Authorization;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Смена роли пользователя админом. Точечная операция: грузит одну строку и меняет RoleId.
    public class UserRoleUpdateService : RepositoryCoreBase<User, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public UserRoleUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        private IEntityRepository<UserRole>? roleRepository;
        private IEntityRepository<UserRole> RoleRepository => roleRepository ??= new EntityRepository<UserRole>(Context);

        // actingUserId вернулся в сигнатуру (D3/D4, 2026-08-09): безусловный запрет из B6
        // снят, и теперь исход зависит от того, кто именно выполняет операцию.
        // Сигнатура — внутренний C#-контракт (не REST), вызывающий один (UsersController).
        public async Task<User> ChangeRoleAsync(int actingUserId, int userId, int roleId)
        {
            var user = await EntityRepository.AsQueryable()
                                             .Include(x => x.Role)
                                             .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"User with id {userId} not found.");

            var role = await RoleRepository.AsQueryable()
                                           .SingleOrDefaultAsync(x => x.Id == roleId, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RoleNotFound, HttpStatusCode.BadRequest,
                           $"Role with id {roleId} not found.");

            // Роль уже такая — операция ничего не меняет, guard'ить нечего.
            if (user.RoleId == roleId)
                return user;

            // IsSuperAdmin читается из БД, а не из claim'а токена (D3): claim решает только,
            // что показать в UI, и подделанный/устаревший токен не должен давать прав.
            var actingUser = await EntityRepository.AsQueryable()
                                                   .SingleOrDefaultAsync(x => x.Id == actingUserId && !x.IsDeleted, cancellationToken)
                             ?? throw new ErrorModelException(GlobalErrorCode.InvalidCredentials, HttpStatusCode.Unauthorized,
                                 "The acting user no longer exists.");

            GuardRoleChange(actingUser, user, role);

            user.RoleId = role.Id;
            user.Role = role;
            await EntityRepository.SaveChangesAsync(cancellationToken);

            return user;
        }

        // D3/D4 (2026-08-09), обновлено под гибкие роли 2026-08-22: правило одно —
        // назначение НА роль с CanManageAdmins, и любая смена роли у того, кто такую роль
        // уже держит, доступны только SuperAdmin'у. Это больше не привязано к конкретному
        // RoleType — CanManageAdmins может стоять у любой (в т.ч. кастомной) роли.
        private static void GuardRoleChange(User actingUser, User target, UserRole newRole)
        {
            // Раньше всей логики про CanManageAdmins (2026-08-27): роль SuperAdmin'у не
            // меняет никто, кроме него самого, — даже другой SuperAdmin. Проверка не зависит
            // от того, какие флаги несут старая и новая роль, поэтому и стоит до них.
            SuperAdminGuard.GuardSuperAdminTarget(target, actingUser.Id);

            var touchesAdminRole = newRole.CanManageAdmins || target.Role.CanManageAdmins;
            if (!touchesAdminRole)
                return;

            // Отбивается и прямой запрос в обход UI (в интерфейсе обычного админа опции
            // "Admin" просто нет) — это и есть защита от IDOR, ради которой guard читает БД.
            if (!actingUser.IsSuperAdmin)
                throw new ErrorModelException(GlobalErrorCode.SuperAdminPrivilegeRequired, HttpStatusCode.Forbidden,
                    "Only a super administrator can manage administrator accounts.");

            // Самозащита (D4, подтверждено Давидом): единственный SuperAdmin не может снять
            // административную роль сам с себя — иначе одним запросом система остаётся без
            // того, кто вообще способен раздавать эту роль обратно.
            if (actingUser.Id == target.Id)
                throw new ErrorModelException(GlobalErrorCode.SuperAdminPrivilegeRequired, HttpStatusCode.Forbidden,
                    "You cannot change your own administrator role.");
        }
    }
}
