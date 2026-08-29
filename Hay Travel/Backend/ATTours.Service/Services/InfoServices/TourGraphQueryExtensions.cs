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
                .Include((Expression<Func<Tour, ICollection<TourTag>>>)(x => x.TourTags))
                // Батч 2026-08-29. Эти три коллекции обязаны быть в графе и на ЧТЕНИИ, и на
                // tracked-загрузке перед реконсилем: без Include TourUpdateService увидел бы
                // пустой existing и на каждом сохранении добавлял бы дубли вместо правки.
                .Include((Expression<Func<Tour, ICollection<TourStartTime>>>)(x => x.StartTimes))
                .Include((Expression<Func<Tour, ICollection<TransferRoutePoint>>>)(x => x.TransferRoutePoints))
                    .ThenInclude(point => point.Translations)
                // Плоско, как TourTags: класс авто (название/вместимость) админка резолвит
                // через VehicleClassController, публичное чтение — своим графом.
                .Include((Expression<Func<Tour, ICollection<TransferPrice>>>)(x => x.TransferPrices));
        }

        // Админский СПИСОК туров (2026-08-16, GetAllAsync — дашборд/страница продуктов): всё, что
        // TourInfoModel несёт на уровне Tour (то же, что IncludeTourGraph), НО без по-дневного
        // контента (TourDay.Translations/GalleryImages/RoutePoints) — именно эта тройная
        // вложенность и была источником cartesian explosion, помноженной здесь ещё и на
        // количество туров в списке. Ни дашборд (StatCards, недавние 5), ни таблица продуктов
        // не читают содержимое дня — только tour.tourDays.length (счётчик), см. tech-debt.md.
        // TourDetails.TourDay ОБЯЗАН остаться Included (без ThenInclude вглубь): маппер строит
        // TourDays через `TourDetails.Select(td => td.TourDay)` — без Include это был бы null на
        // каждом элементе (TourDay — не HashSet со своим default, а голая reference-навигация).
        public static IEntityQueryableRepository<Tour> IncludeTourAdminListGraph(this IEntityQueryableRepository<Tour> query)
        {
            return query
                .Include((Expression<Func<Tour, ICollection<TourDetail>>>)(x => x.TourDetails))
                    .ThenInclude(td => td.TourDay)
                .Include(x => x.Translations)
                .Include((Expression<Func<Tour, ICollection<AdditionalExpense>>>)(x => x.AdditionalExpenses))
                    .ThenInclude(ae => ae.Translations)
                .Include((Expression<Func<Tour, ICollection<TourNote>>>)(x => x.Notes))
                    .ThenInclude(n => n.Translations)
                .Include((Expression<Func<Tour, ICollection<TourRegion>>>)(x => x.TourRegions))
                    .ThenInclude(tr => tr.Region)
                .Include((Expression<Func<Tour, ICollection<TourTag>>>)(x => x.TourTags))
                // Батч 2026-08-29: в отличие от по-дневного контента это узкие коллекции
                // (единицы строк на продукт) — в списке они дешёвые, зато без них строка
                // трансфера в админском списке выглядела бы как продукт без маршрута и цен.
                .Include((Expression<Func<Tour, ICollection<TourStartTime>>>)(x => x.StartTimes))
                .Include((Expression<Func<Tour, ICollection<TransferRoutePoint>>>)(x => x.TransferRoutePoints))
                    .ThenInclude(point => point.Translations)
                .Include((Expression<Func<Tour, ICollection<TransferPrice>>>)(x => x.TransferPrices));
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

        // Публичный СПИСОК трансферов (/transfers, батч 2026-08-29): название + картинка +
        // маршрут + цены (нужна цена «от»). Ни дней, ни регионов, ни тегов у трансфера не
        // бывает — грузить турный card-граф здесь нечего. Сам VehicleClass нужен даже в
        // списке (без переводов): цена «от» считается только по АКТИВНЫМ классам, иначе
        // карточка обещала бы цену класса, который уже не продаётся.
        public static IEntityQueryableRepository<Tour> IncludeTransferCardGraph(this IEntityQueryableRepository<Tour> query)
        {
            return query
                .Include(x => x.Translations)
                .Include((Expression<Func<Tour, ICollection<TransferRoutePoint>>>)(x => x.TransferRoutePoints))
                    .ThenInclude(point => point.Translations)
                .Include((Expression<Func<Tour, ICollection<TransferPrice>>>)(x => x.TransferPrices))
                    .ThenInclude(price => price.VehicleClass);
        }

        // Публичная ДЕТАЛЬНАЯ трансфера (/transfers/:id): то же плюс сам класс авто с
        // переводами — таблица «класс -> две цены + вместимость/багаж» строится прямо из
        // ответа, без второго запроса к справочнику.
        public static IEntityQueryableRepository<Tour> IncludeTransferDetailGraph(this IEntityQueryableRepository<Tour> query)
        {
            return query
                .Include(x => x.Translations)
                .Include((Expression<Func<Tour, ICollection<TransferRoutePoint>>>)(x => x.TransferRoutePoints))
                    .ThenInclude(point => point.Translations)
                .Include((Expression<Func<Tour, ICollection<TransferPrice>>>)(x => x.TransferPrices))
                    .ThenInclude(price => price.VehicleClass)
                        .ThenInclude(vehicleClass => vehicleClass.Translations);
        }
    }
}
