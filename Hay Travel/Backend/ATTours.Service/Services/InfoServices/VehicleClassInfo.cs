using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение справочника классов авто (батч 2026-08-29) — по образцу TagInfo.
    public class VehicleClassInfo : EntityInfoBase<VehicleClass>
    {
        public VehicleClassInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public VehicleClassInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public VehicleClassInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        protected override IEntityQueryableRepository<VehicleClass> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository().Include(x => x.Translations);
        }

        public async Task<VehicleClass> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }
    }
}
