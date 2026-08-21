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

        // Список (GetAllAsync — дашборд, страница продуктов): облегчённый граф без по-дневного
        // контента, см. IncludeTourAdminListGraph. AsSplitQuery — страховка на случай тура с
        // необычно большим числом доп. расходов/заметок/тегов, тот же приём, что и везде здесь.
        protected override IEntityQueryableRepository<Tour> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository().IncludeTourAdminListGraph().AsSplitQuery();
        }

        // Открытие ОДНОГО тура на редактирование — полный граф (форма редактирует все дни,
        // фото, точки маршрута), поэтому НЕ переиспользует GetEntityQueryableRepository() выше
        // (тот — облегчённый, для списка). AsSplitQuery (2026-08-16, см.
        // TourClientInfo.GetClientDetailAsync): тот же cartesian-explosion фикс, что и на
        // клиентском чтении — тур с большой галереей уходил на секунды в один JOIN-запрос.
        public async Task<Tour> InitUpdate(int id, CancellationToken cancellationToken = default)
        {
            return await base.GetEntityQueryableRepository()
                              .IncludeTourGraph()
                              .AsSplitQuery()
                              .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }
    }
}
