using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;

namespace ATTours.BusinessServices.Services.InfoServices
{
    public class TourInfo : EntityInfoBase<Tour>
    {
        public TourInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public TourInfo(string connectionString, CancellationToken cancellationToken = default) : base(connectionString, cancellationToken)
        {
        }

        public TourInfo(IApplicationDbContext context, CancellationToken cancellationToken = default) : base(context, cancellationToken)
        {
        }

        protected override IEntityQueryableRepository<Tour> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository().IncludeTourGraph();
        }

        public async Task<Tour> InitUpdate(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }
    }
}
