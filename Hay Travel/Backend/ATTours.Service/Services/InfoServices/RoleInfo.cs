using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение ролей вместе с их матрицей прав (экран управления ролями, GET api/Roles).
    // Разворачиванием матрицы по всем экранам реестра занимается маппинг — здесь только
    // строки, которые реально есть в БД.
    public class RoleInfo : EntityInfoBase<UserRole>
    {
        public RoleInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public RoleInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public RoleInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        protected override IEntityQueryableRepository<UserRole> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository().Include(x => x.Permissions);
        }

        public async Task<UserRole> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }

        // RoleId -> сколько НЕ удалённых пользователей на роли: UI показывает это в списке
        // и объясняет, почему роль нельзя удалить (RoleInUse, §0.4). Тот же приём, что
        // RegionInfo.GetPublicTourCountsAsync — считаем по сведённому списку id, не по графу.
        public async Task<Dictionary<int, int>> GetUserCountsAsync(CancellationToken cancellationToken = default)
        {
            var roleIds = await new EntityRepository<User>(Context)
                .AsQueryable()
                .Where(user => !user.IsDeleted)
                .Select(user => user.RoleId)
                .ToListAsync(cancellationToken);

            return roleIds
                .GroupBy(roleId => roleId)
                .ToDictionary(group => group.Key, group => group.Count());
        }
    }
}
