using ATTours.Common.Entities;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using System.Linq.Expressions;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Единая декларация графа Include для чтения тура целиком.
    // Используется как для NoTracking-чтения (TourInfo), так и для tracked-загрузки
    // при обновлении (TourUpdateService), чтобы цепочка Include не дублировалась.
    public static class TourGraphQueryExtensions
    {
        // TourDetails/AdditionalExpenses объявлены как HashSet<>, поэтому для выбора
        // коллекционной перегрузки Include (а не identity) лямбда приводится к
        // ICollection<> — иначе ThenInclude видит HashSet<> вместо элемента.
        public static IEntityQueryableRepository<Tour> IncludeTourGraph(this IEntityQueryableRepository<Tour> query)
        {
            return query
                .Include((Expression<Func<Tour, ICollection<TourDetail>>>)(x => x.TourDetails))
                    .ThenInclude(td => td.TourDay)
                        .ThenInclude(day => day.Translations)
                .Include((Expression<Func<Tour, ICollection<TourDetail>>>)(x => x.TourDetails))
                    .ThenInclude(td => td.TourDay)
                        .ThenInclude(day => day.GalleryImages)
                .Include((Expression<Func<Tour, ICollection<TourDetail>>>)(x => x.TourDetails))
                    .ThenInclude(td => td.TourDay)
                        .ThenInclude((Expression<Func<TourDay, ICollection<RoutePoint>>>)(day => day.RoutePoints))
                            .ThenInclude(rp => rp.Translations)
                .Include(x => x.Translations)
                .Include((Expression<Func<Tour, ICollection<AdditionalExpense>>>)(x => x.AdditionalExpenses))
                    .ThenInclude(ae => ae.Translations)
                // Орг. детали и ограничения — одна коллекция Notes, различаются по Type (ADR 003).
                .Include((Expression<Func<Tour, ICollection<TourNote>>>)(x => x.Notes))
                    .ThenInclude(n => n.Translations)
                // Переводы региона в граф тура не включаются (TourRegionInfoModel — плоская проекция).
                .Include((Expression<Func<Tour, ICollection<TourRegion>>>)(x => x.TourRegions))
                    .ThenInclude(tr => tr.Region)
                // Плоско, как TourRegions — Tag не грузится (TourTagInfoModel не несёт его полей,
                // каталог тегов фронт резолвит через TagController).
                .Include((Expression<Func<Tour, ICollection<TourTag>>>)(x => x.TourTags));
        }

        // Публичный путь чтения ОДНОГО тура (пункт 3.5): весь общий граф + переводы шаблонов
        // каталога (Place/ExpenseTemplate/TourNoteTemplate), чтобы CatalogOverrideResolver мог
        // свернуть own(lang) ?? template(lang). Утяжеление ТОЛЬКО здесь — общий IncludeTourGraph и
        // админский путь (TourInfo) остаются «сырыми» и лёгкими (D-7). Гео/фото Place
        // (Latitude/Longitude/ImageUrl/RegionId) в резолве не участвуют — наружу их не выносим (D-13),
        // поэтому Place.Region/координаты сюда не тянем, только Place.Translations.
        public static IEntityQueryableRepository<Tour> IncludeTourGraphForClient(this IEntityQueryableRepository<Tour> query)
        {
            return query
                .IncludeTourGraph()
                .Include((Expression<Func<Tour, ICollection<TourDetail>>>)(x => x.TourDetails))
                    .ThenInclude(td => td.TourDay)
                        .ThenInclude((Expression<Func<TourDay, ICollection<RoutePoint>>>)(day => day.RoutePoints))
                            .ThenInclude(rp => rp.Place)
                                .ThenInclude(place => place.Translations)
                .Include((Expression<Func<Tour, ICollection<AdditionalExpense>>>)(x => x.AdditionalExpenses))
                    .ThenInclude(ae => ae.ExpenseTemplate)
                        .ThenInclude(template => template.Translations)
                .Include((Expression<Func<Tour, ICollection<TourNote>>>)(x => x.Notes))
                    .ThenInclude(n => n.TourNoteTemplate)
                        .ThenInclude(template => template.Translations);
        }

        // Публичный путь чтения СПИСКА карточек (пункт 3.5, D-11): облегчённый граф — только то,
        // что рисует карточка. По-дневной граф/точки/расходы/заметки НЕ грузятся (карточка их не
        // показывает, резолв каталога на списке не нужен). TourDetails включены лишь ради счётчика
        // дней (DurationDays = TourDetails.Count), без TourDay и вложенного графа дня.
        public static IEntityQueryableRepository<Tour> IncludeTourCardGraph(this IEntityQueryableRepository<Tour> query)
        {
            return query
                .Include(x => x.Translations)
                .Include((Expression<Func<Tour, ICollection<TourRegion>>>)(x => x.TourRegions))
                    .ThenInclude(tr => tr.Region)
                .Include((Expression<Func<Tour, ICollection<TourDetail>>>)(x => x.TourDetails))
                .Include((Expression<Func<Tour, ICollection<TourTag>>>)(x => x.TourTags));
        }
    }
}
