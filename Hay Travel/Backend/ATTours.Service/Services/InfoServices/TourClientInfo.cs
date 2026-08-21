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
        //
        // AsSplitQuery (2026-08-16): этот граф тянет ~8 sibling-коллекций с одного корня
        // (TourDetails→TourDay→{Translations, GalleryImages, RoutePoints→...}, плюс
        // Translations/AdditionalExpenses/Notes/TourRegions/TourTags на самом Tour). Одним
        // JOIN-запросом (дефолт EF Core) это даёт cartesian-произведение строк по ВСЕМ
        // коллекциям сразу — с малым числом фото в галерее дня незаметно, но с реальной
        // загрузкой в десятки фото на тур запрос уходил за 10 секунд (замерено вживую на
        // проде после жалобы "долго открывается тур"). AsSplitQuery меняет это на отдельный
        // SQL-запрос по каждой коллекции — то же дерево данных, на порядки быстрее на широких
        // графах.
        public async Task<Tour> GetClientDetailAsync(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository()
                .IncludeTourGraphForClient()
                .AsSplitQuery()
                .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }
    }
}
