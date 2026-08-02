using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;

namespace ATTours.BusinessServices.Services.InfoServices
{
    public class RegionInfo : EntityInfoBase<Region>
    {
        public RegionInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public RegionInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public RegionInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        protected override IEntityQueryableRepository<Region> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository().Include(x => x.Translations);
        }

        // RegionId -> количество туров, видимых на публичном сайте (IsActive && !IsArchived).
        // Where + Select идут через абстракцию репозитория (переводятся в SQL), группировка
        // выполняется уже над сведённым в память списком RegionId — дешёвая операция над
        // крошечной join-таблицей, не над полным графом туров.
        public async Task<Dictionary<int, int>> GetPublicTourCountsAsync(CancellationToken cancellationToken = default)
        {
            var regionIds = await new EntityRepository<TourRegion>(Context)
                .AsQueryable()
                .Where(tourRegion => tourRegion.Tour.IsActive && !tourRegion.Tour.IsArchived)
                .Select(tourRegion => tourRegion.RegionId)
                .ToListAsync(cancellationToken);

            return regionIds
                .GroupBy(regionId => regionId)
                .ToDictionary(group => group.Key, group => group.Count());
        }
    }
}
