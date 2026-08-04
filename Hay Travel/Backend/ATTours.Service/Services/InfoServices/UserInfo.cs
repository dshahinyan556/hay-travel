using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение пользователей для админки. Роль включена всегда: UserInfoModel отдаёт
    // RoleType, а не только RoleId.
    public class UserInfo : EntityInfoBase<User>
    {
        public UserInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public UserInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public UserInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        protected override IEntityQueryableRepository<User> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository().Include(x => x.Role);
        }

        public async Task<User> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }
    }
}
