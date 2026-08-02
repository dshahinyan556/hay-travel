using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using System.Linq.Expressions;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Клиентская (публичная) read-модель тура — отделена от админской TourInfo (D-7: это разные
    // read-модели). Список карточек и детальная используют РАЗНЫЕ Include-графы, поэтому базовый
    // GetEntityQueryableRepository() здесь НЕ переопределяется (иначе список тянул бы тяжёлый
    // клиентский граф и резолвил его ×N — ровно то, что убирает D-11). Каждый путь строит свой граф.
    // Резолв каталожных override делает TourOverrideProjection над результатом (в БД ничего не пишется).
    public class TourClientInfo : EntityInfoBase<Tour>
    {
        public TourClientInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public TourClientInfo(string connectionString, CancellationToken cancellationToken = default) : base(connectionString, cancellationToken)
        {
        }

        public TourClientInfo(IApplicationDbContext context, CancellationToken cancellationToken = default) : base(context, cancellationToken)
        {
        }

        // Список карточек: облегчённый граф (тур-уровень + регионы + счётчик дней), NoTracking.
        // Фильтр (IsActive && !IsArchived [+ ?region=]) приходит из контроллера как предикат.
        public async Task<List<Tour>> GetCardsAsync(Expression<Func<Tour, bool>> where, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository()
                .IncludeTourCardGraph()
                .Where(where)
                .ToListAsync(cancellationToken);
        }

        // Детальная одного тура: полный клиентский граф + переводы шаблонов каталога для резолва.
        // Not-found-фильтр (черновик/архив = 404) остаётся в контроллере, как и раньше.
        public async Task<Tour> GetClientDetailAsync(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository()
                .IncludeTourGraphForClient()
                .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }
    }
}
