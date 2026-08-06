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

        // actingUserId больше не нужен (B6, 2026-08-06): self-guard существовал только внутри
        // GuardAdminDemotionAsync и полностью поглощён безусловным GuardAdminDemotion ниже —
        // держать неиспользуемый параметр не имеет смысла. Сигнатура — внутренний C#-контракт
        // (не REST), править вызывающего в UsersController безопасно в рамках этой же правки.
        public async Task<User> ChangeRoleAsync(int userId, int roleId)
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

            GuardAdminDemotion(user, role);

            user.RoleId = role.Id;
            user.Role = role;
            await EntityRepository.SaveChangesAsync(cancellationToken);

            return user;
        }

        // Роль Admin неизменна через этот эндпоинт (B6, 2026-08-06) — снятие роли Admin у
        // кого угодно кем угодно запрещено безусловно. Это полностью поглощает прежние два
        // частных случая (self/last-admin): оба были лишь подмножеством "цель — Admin",
        // поэтому старая GuardAdminDemotionAsync с их отдельными сообщениями удалена —
        // недостижимый код хуже, чем один guard на всё правило.
        private static void GuardAdminDemotion(User user, UserRole newRole)
        {
            var isAdminDemotion = user.Role.Type == RoleType.Admin && newRole.Type != RoleType.Admin;
            if (!isAdminDemotion)
                return;

            throw new ErrorModelException(GlobalErrorCode.AdminRoleImmutable, HttpStatusCode.Forbidden,
                "The Admin role can only be changed directly in the database.");
        }
    }
}
