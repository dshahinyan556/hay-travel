using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение каталога точек (3.4). Include(Region) нужен для денормализованного RegionSlug
    // в PlaceInfoModel; переводы региона не тянутся.
    public class PlaceInfo : EntityInfoBase<Place>
    {
        public PlaceInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public PlaceInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public PlaceInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        protected override IEntityQueryableRepository<Place> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository()
                       .Include(x => x.Translations)
                       .Include(x => x.Region);
        }

        public async Task<Place> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }
    }
}
