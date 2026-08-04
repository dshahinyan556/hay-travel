using ArmeniaTours.DataLayer;
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

        public async Task<User> ChangeRoleAsync(int userId, int roleId, int actingUserId)
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

            if (user.RoleId == roleId)
                return user;

            await GuardAdminDemotionAsync(user, role, actingUserId);

            user.RoleId = role.Id;
            user.Role = role;
            await EntityRepository.SaveChangesAsync(cancellationToken);

            return user;
        }

        // Снятие роли Admin — единственный необратимый сценарий: админ может запереть
        // сам себя или оставить систему вообще без администратора.
        private async Task GuardAdminDemotionAsync(User user, UserRole newRole, int actingUserId)
        {
            var isAdminDemotion = user.Role.Type == RoleType.Admin && newRole.Type != RoleType.Admin;
            if (!isAdminDemotion)
                return;

            if (user.Id == actingUserId)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    "You cannot remove the Admin role from yourself.");

            var adminCount = await EntityRepository.AsQueryable()
                                                   .Where(x => x.Role.Type == RoleType.Admin)
                                                   .CountAsync(cancellationToken);
            if (adminCount <= 1)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    "The last Admin cannot be demoted.");
        }
    }
}
