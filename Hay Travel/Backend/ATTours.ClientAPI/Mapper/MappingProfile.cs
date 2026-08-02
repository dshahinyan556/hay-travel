using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Init;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.SiteSettings;

namespace ATTours.ClientAPI.Mapper.MappingProfile
{

    using AutoMapper;
    using System.Linq;

    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            // ============= Mappings for TOUR =============

            // Tour -> TourInfoModel (для GET запросов)
            CreateMap<Tour, TourInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => src.IsActive))
                .ForMember(dest => dest.IsFeatured, opt => opt.MapFrom(src => src.IsFeatured))
                .ForMember(dest => dest.FeaturedSortOrder, opt => opt.MapFrom(src => src.FeaturedSortOrder))
                .ForMember(dest => dest.TotalPrice, opt => opt.MapFrom(src => src.TotalPrice))
                .ForMember(dest => dest.MainImageUrl, opt => opt.MapFrom(src => src.MainImageUrl))
                .ForMember(dest => dest.Translations,
                    opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.AdditionalExpenses,
                    opt => opt.MapFrom(src => src.AdditionalExpenses))
                // Заметки идут сгруппированно по виду, а внутри вида — по своему SortOrder:
                // сквозного порядка по всем заметкам тура не существует (ADR 003).
                .ForMember(dest => dest.Notes,
                    opt => opt.MapFrom(src => src.Notes.OrderBy(n => n.Type).ThenBy(n => n.SortOrder)))
                .ForMember(dest => dest.Regions,
                    opt => opt.MapFrom(src => src.TourRegions.OrderBy(tr => tr.SortOrder)))
                // TourDays собираем из TourDetails, сохраняя порядок по SortOrder
                .ForMember(dest => dest.TourDays, opt => opt.MapFrom(src =>
                    src.TourDetails
                        .OrderBy(td => td.SortOrder)
                        .Select(td => td.TourDay)
                        .ToList()));

            // TourCreateModel -> Tour (для создания)
            CreateMap<TourCreateModel, Tour>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TotalPrice, opt => opt.Ignore())
                .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => src.IsActive))
                .ForMember(dest => dest.TourDetails, opt => opt.Ignore())
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.AdditionalExpenses, opt => opt.MapFrom(src => src.AdditionalExpenses))
                .ForMember(dest => dest.Notes, opt => opt.MapFrom(src => src.Notes))
                .ForMember(dest => dest.TourRegions, opt => opt.MapFrom(src => src.Regions))
                .AfterMap((src, dest, context) => BuildTourDetails(src.TourDays, dest, context.Mapper));

            // TourInfoModel -> Tour (для обновления)
            // Regions == null -> AutoMapper (AllowNullCollections = true) маппит TourRegions
            // в null, что TourUpdateService трактует как «не трогать регионы»;
            // Regions == [] -> TourRegions становится пустой коллекцией -> «очистить все».
            CreateMap<TourInfoModel, Tour>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.MainImageUrl, opt => opt.MapFrom(src => src.MainImageUrl))
                .ForMember(dest => dest.TotalPrice, opt => opt.Ignore())
                .ForMember(dest => dest.IsActive, opt => opt.Ignore())
                .ForMember(dest => dest.IsFeatured, opt => opt.Ignore())
                .ForMember(dest => dest.FeaturedSortOrder, opt => opt.Ignore())
                .ForMember(dest => dest.TourDetails, opt => opt.Ignore())
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.AdditionalExpenses, opt => opt.MapFrom(src => src.AdditionalExpenses))
                .ForMember(dest => dest.Notes, opt => opt.MapFrom(src => src.Notes))
                .ForMember(dest => dest.TourRegions, opt => opt.MapFrom(src => src.Regions))
                .AfterMap((src, dest, context) => BuildTourDetails(src.TourDays, dest, context.Mapper));

            // Tour -> TourCardModel (публичный список карточек, пункт 3.5 / D-11).
            // Облегчённая проекция: тур-уровневые переводы (одна локаль — фильтрует Service),
            // регионы (плоские слаги) и число дней. Резолв каталожных override здесь НЕ делается —
            // карточка каталожных полей не показывает (он только в детальной, в Service-слое).
            CreateMap<Tour, TourCardModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.TotalPrice, opt => opt.MapFrom(src => src.TotalPrice))
                .ForMember(dest => dest.MainImageUrl, opt => opt.MapFrom(src => src.MainImageUrl))
                // Длительность в днях = число TourDetails (граф дня в card-модель не грузится).
                .ForMember(dest => dest.DurationDays, opt => opt.MapFrom(src => src.TourDetails.Count))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.Regions,
                    opt => opt.MapFrom(src => src.TourRegions.OrderBy(tr => tr.SortOrder)));

            // ============= МАППИНГИ ДЛЯ TOURDAY =============

            // TourDay -> TourDayInfoModel
            CreateMap<TourDay, TourDayInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Price, opt => opt.MapFrom(src => src.Price))
                .ForMember(dest => dest.Translations,
                    opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.GalleryImages,
                    opt => opt.MapFrom(src => src.GalleryImages.OrderBy(gi => gi.SortOrder)))
                .ForMember(dest => dest.RoutePoints,
                    opt => opt.MapFrom(src => src.RoutePoints.OrderBy(rp => rp.SortOrder)));

            // TourDayCreateModel -> TourDay
            CreateMap<TourDayCreateModel, TourDay>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourDetails, opt => opt.Ignore())
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.GalleryImages, opt => opt.MapFrom(src => src.GalleryImages))
                .ForMember(dest => dest.RoutePoints, opt => opt.MapFrom(src => src.RoutePoints));

            // TourDayInfoModel -> TourDay (для обновления)
            // Id сохраняется, дальше слой обновления сверяет сущности по Id (add/update/remove)
            CreateMap<TourDayInfoModel, TourDay>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Price, opt => opt.MapFrom(src => src.Price))
                .ForMember(dest => dest.TourDetails, opt => opt.Ignore())
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.GalleryImages, opt => opt.MapFrom(src => src.GalleryImages))
                .ForMember(dest => dest.RoutePoints, opt => opt.MapFrom(src => src.RoutePoints));

            // ============= Mappings for ROUTEPOINT =============

            // RoutePoint -> RoutePointInfoModel
            CreateMap<RoutePoint, RoutePointInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                // Ссылка на каталог Place (3.4) — «сырой» проброс FK, без резолва override (D-7).
                .ForMember(dest => dest.PlaceId, opt => opt.MapFrom(src => src.PlaceId))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // RoutePointCreateModel -> RoutePoint
            CreateMap<RoutePointCreateModel, RoutePoint>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourDayId, opt => opt.Ignore())
                .ForMember(dest => dest.TourDay, opt => opt.Ignore())
                .ForMember(dest => dest.Place, opt => opt.Ignore())
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.PlaceId, opt => opt.MapFrom(src => src.PlaceId))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // RoutePointInfoModel -> RoutePoint (для обновления)
            CreateMap<RoutePointInfoModel, RoutePoint>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.TourDayId, opt => opt.Ignore())
                .ForMember(dest => dest.TourDay, opt => opt.Ignore())
                .ForMember(dest => dest.Place, opt => opt.Ignore())
                .ForMember(dest => dest.PlaceId, opt => opt.MapFrom(src => src.PlaceId))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ============= Mappings for TOURNOTE =============
            // Одна сущность вместо OrganizationalDetail + Restriction (ADR 003):
            // вид заметки несёт Type, SortOrder осмыслен только внутри своего Type.

            // TourNote -> TourNoteInfoModel
            CreateMap<TourNote, TourNoteInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                // Ссылка на каталог TourNoteTemplate (3.4) — «сырой» проброс FK (D-7).
                .ForMember(dest => dest.TourNoteTemplateId, opt => opt.MapFrom(src => src.TourNoteTemplateId))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // TourNoteCreateModel -> TourNote
            CreateMap<TourNoteCreateModel, TourNote>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.TourNoteTemplate, opt => opt.Ignore())
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.TourNoteTemplateId, opt => opt.MapFrom(src => src.TourNoteTemplateId))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // TourNoteInfoModel -> TourNote (для обновления)
            CreateMap<TourNoteInfoModel, TourNote>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.TourNoteTemplate, opt => opt.Ignore())
                .ForMember(dest => dest.TourNoteTemplateId, opt => opt.MapFrom(src => src.TourNoteTemplateId))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ============= Mappings for ADDITIONALEXPENSE =============

            // AdditionalExpense -> AdditionalExpenseInfoModel
            CreateMap<AdditionalExpense, AdditionalExpenseInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Amount, opt => opt.MapFrom(src => src.Amount))
                // Ссылка на каталог ExpenseTemplate (3.4) — «сырой» проброс FK (D-7).
                .ForMember(dest => dest.ExpenseTemplateId, opt => opt.MapFrom(src => src.ExpenseTemplateId))
                .ForMember(dest => dest.Translations,
                    opt => opt.MapFrom(src => src.Translations));

            // AdditionalExpenseCreateModel -> AdditionalExpense
            CreateMap<AdditionalExpenseCreateModel, AdditionalExpense>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.ExpenseTemplate, opt => opt.Ignore())
                .ForMember(dest => dest.ExpenseTemplateId, opt => opt.MapFrom(src => src.ExpenseTemplateId))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // AdditionalExpenseInfoModel -> AdditionalExpense (for update)
            CreateMap<AdditionalExpenseInfoModel, AdditionalExpense>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Amount, opt => opt.MapFrom(src => src.Amount))
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.ExpenseTemplate, opt => opt.Ignore())
                .ForMember(dest => dest.ExpenseTemplateId, opt => opt.MapFrom(src => src.ExpenseTemplateId))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ============= Mappings for GALLERYIMAGE =============

            // GalleryImage -> GalleryImageInfoModel
            CreateMap<GalleryImage, GalleryImageInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Url, opt => opt.MapFrom(src => src.Url))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder));

            // GalleryImageCreateModel -> GalleryImage
            CreateMap<GalleryImageCreateModel, GalleryImage>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourDayId, opt => opt.Ignore())
                .ForMember(dest => dest.TourDay, opt => opt.Ignore());

            // GalleryImageInfoModel -> GalleryImage (для обновления)
            CreateMap<GalleryImageInfoModel, GalleryImage>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Url, opt => opt.MapFrom(src => src.Url))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.TourDayId, opt => opt.Ignore())
                .ForMember(dest => dest.TourDay, opt => opt.Ignore());

            // ============= Mappings for SITESETTING =============

            // SiteSetting -> SiteSettingInfoModel (для GET запросов).
            // Метаданные ключа в БД не хранятся и берутся из каталога в коде (ADR 002) —
            // осознанное исключение из правила «маппер только перекладывает поля»:
            // каталог статичен, без DI и без состояния.
            CreateMap<SiteSetting, SiteSettingInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Key, opt => opt.MapFrom(src => src.Key))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.Group, opt => opt.Ignore())
                .ForMember(dest => dest.ValueType, opt => opt.Ignore())
                .ForMember(dest => dest.IsTranslatable, opt => opt.Ignore())
                .ForMember(dest => dest.IsPublic, opt => opt.Ignore())
                .ForMember(dest => dest.SortOrder, opt => opt.Ignore())
                .AfterMap((src, dest) => ApplyCatalogMetadata(src, dest));

            // SiteSettingUpdateModel -> SiteSetting (для upsert).
            // Id не переносится: идентичность записи — Key.
            CreateMap<SiteSettingUpdateModel, SiteSetting>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.Key, opt => opt.MapFrom(src => src.Key))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ============= Mappings for REGION =============

            // Region -> RegionInfoModel. TourCount не заполняется здесь: он приходит
            // из RegionInfo.GetPublicTourCountsAsync и проставляется контроллером
            // (сшивка со словарём — не задача маппера одной сущности).
            CreateMap<Region, RegionInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Slug, opt => opt.MapFrom(src => src.Slug))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.TourCount, opt => opt.Ignore());

            // ============= Mappings for TOURREGION =============

            // TourRegion -> TourRegionInfoModel: плоская проекция в граф тура,
            // Slug денормализуется из связанного Region (переводы региона не едут).
            CreateMap<TourRegion, TourRegionInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.RegionId, opt => opt.MapFrom(src => src.RegionId))
                .ForMember(dest => dest.Slug, opt => opt.MapFrom(src => src.Region.Slug))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder));

            // TourRegionCreateModel -> TourRegion
            CreateMap<TourRegionCreateModel, TourRegion>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.Region, opt => opt.Ignore())
                .ForMember(dest => dest.RegionId, opt => opt.MapFrom(src => src.RegionId))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder));

            // TourRegionInfoModel -> TourRegion (для обновления)
            CreateMap<TourRegionInfoModel, TourRegion>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.Region, opt => opt.Ignore())
                .ForMember(dest => dest.RegionId, opt => opt.MapFrom(src => src.RegionId))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder));

            // ============= Mappings for PLACE =============
            // Каталог точек (3.4). RegionSlug денормализуется из связанного Region (переводы
            // региона не тянутся). Override резолвится не здесь, а в Service (3.5).

            // Place -> PlaceInfoModel
            CreateMap<Place, PlaceInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Slug, opt => opt.MapFrom(src => src.Slug))
                .ForMember(dest => dest.RegionId, opt => opt.MapFrom(src => src.RegionId))
                .ForMember(dest => dest.RegionSlug, opt => opt.MapFrom(src => src.Region.Slug))
                .ForMember(dest => dest.Latitude, opt => opt.MapFrom(src => src.Latitude))
                .ForMember(dest => dest.Longitude, opt => opt.MapFrom(src => src.Longitude))
                .ForMember(dest => dest.ImageUrl, opt => opt.MapFrom(src => src.ImageUrl))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // PlaceCreateModel -> Place
            CreateMap<PlaceCreateModel, Place>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.Region, opt => opt.Ignore())
                .ForMember(dest => dest.RoutePoints, opt => opt.Ignore())
                .ForMember(dest => dest.Slug, opt => opt.MapFrom(src => src.Slug))
                .ForMember(dest => dest.RegionId, opt => opt.MapFrom(src => src.RegionId))
                .ForMember(dest => dest.Latitude, opt => opt.MapFrom(src => src.Latitude))
                .ForMember(dest => dest.Longitude, opt => opt.MapFrom(src => src.Longitude))
                .ForMember(dest => dest.ImageUrl, opt => opt.MapFrom(src => src.ImageUrl))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // PlaceInfoModel -> Place (для обновления, Update идёт через Info-модель с Id)
            CreateMap<PlaceInfoModel, Place>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Region, opt => opt.Ignore())
                .ForMember(dest => dest.RoutePoints, opt => opt.Ignore())
                .ForMember(dest => dest.Slug, opt => opt.MapFrom(src => src.Slug))
                .ForMember(dest => dest.RegionId, opt => opt.MapFrom(src => src.RegionId))
                .ForMember(dest => dest.Latitude, opt => opt.MapFrom(src => src.Latitude))
                .ForMember(dest => dest.Longitude, opt => opt.MapFrom(src => src.Longitude))
                .ForMember(dest => dest.ImageUrl, opt => opt.MapFrom(src => src.ImageUrl))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ============= Mappings for EXPENSETEMPLATE =============
            // Каталог шаблонов расходов (3.4). Дефолтной суммы не несёт (D-8).

            // ExpenseTemplate -> ExpenseTemplateInfoModel
            CreateMap<ExpenseTemplate, ExpenseTemplateInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ExpenseTemplateCreateModel -> ExpenseTemplate
            CreateMap<ExpenseTemplateCreateModel, ExpenseTemplate>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.AdditionalExpenses, opt => opt.Ignore())
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ExpenseTemplateInfoModel -> ExpenseTemplate (для обновления)
            CreateMap<ExpenseTemplateInfoModel, ExpenseTemplate>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.AdditionalExpenses, opt => opt.Ignore())
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ============= Mappings for TOURNOTETEMPLATE =============
            // Каталог шаблонов заметок (3.4). Type переиспользует TourNoteType из 3.3.

            // TourNoteTemplate -> TourNoteTemplateInfoModel
            CreateMap<TourNoteTemplate, TourNoteTemplateInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // TourNoteTemplateCreateModel -> TourNoteTemplate
            CreateMap<TourNoteTemplateCreateModel, TourNoteTemplate>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourNotes, opt => opt.Ignore())
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // TourNoteTemplateInfoModel -> TourNoteTemplate (для обновления)
            CreateMap<TourNoteTemplateInfoModel, TourNoteTemplate>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.TourNotes, opt => opt.Ignore())
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ============= Mappings for translations =============

            // ---- CreateModel -> Entity (создание) ----

            CreateMap<TranslatableCreateModel, AdditionalExpenseTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.AdditionalExpenseId, opt => opt.Ignore())
                .ForMember(dest => dest.AdditionalExpense, opt => opt.Ignore())
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => (ExpenseTranslationType)src.Type))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TranslatableCreateModel, TourInfoTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => (TourTranslationType)src.Type))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TranslatableCreateModel, TourDayInfoTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourDayId, opt => opt.Ignore())
                .ForMember(dest => dest.TourDay, opt => opt.Ignore())
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => (TourDayTranslationType)src.Type))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у точки маршрута семантически не используется (игнорируется)
            CreateMap<TranslatableCreateModel, RoutePointTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.RoutePointId, opt => opt.Ignore())
                .ForMember(dest => dest.RoutePoint, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у перевода заметки семантически не используется (вид заметки живёт
            // на самой TourNote.Type, у перевода одно текстовое поле) — игнорируется
            CreateMap<TranslatableCreateModel, TourNoteTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourNoteId, opt => opt.Ignore())
                .ForMember(dest => dest.TourNote, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у настройки сайта семантически не используется (игнорируется)
            CreateMap<TranslatableCreateModel, SiteSettingTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.SiteSettingId, opt => opt.Ignore())
                .ForMember(dest => dest.SiteSetting, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Каталоги 3.4 — у их переводов своего Type нет (игнорируется).
            CreateMap<TranslatableCreateModel, PlaceTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.PlaceId, opt => opt.Ignore())
                .ForMember(dest => dest.Place, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TranslatableCreateModel, ExpenseTemplateTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.ExpenseTemplateId, opt => opt.Ignore())
                .ForMember(dest => dest.ExpenseTemplate, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TranslatableCreateModel, TourNoteTemplateTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourNoteTemplateId, opt => opt.Ignore())
                .ForMember(dest => dest.TourNoteTemplate, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // ---- InfoModel -> Entity (обновление) ----
            // Id сохраняется, чтобы слой обновления сверял переводы по Id

            CreateMap<TranslatableInfoModel, AdditionalExpenseTranslation>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.AdditionalExpenseId, opt => opt.Ignore())
                .ForMember(dest => dest.AdditionalExpense, opt => opt.Ignore())
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => (ExpenseTranslationType)src.Type))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TranslatableInfoModel, TourInfoTranslation>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => (TourTranslationType)src.Type))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TranslatableInfoModel, TourDayInfoTranslation>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.TourDayId, opt => opt.Ignore())
                .ForMember(dest => dest.TourDay, opt => opt.Ignore())
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => (TourDayTranslationType)src.Type))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у точки маршрута семантически не используется (игнорируется)
            CreateMap<TranslatableInfoModel, RoutePointTranslation>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.RoutePointId, opt => opt.Ignore())
                .ForMember(dest => dest.RoutePoint, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у перевода заметки семантически не используется (игнорируется)
            CreateMap<TranslatableInfoModel, TourNoteTranslation>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.TourNoteId, opt => opt.Ignore())
                .ForMember(dest => dest.TourNote, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Каталоги 3.4 — Id сохраняется, чтобы Update-сервис сверял переводы по Id.
            CreateMap<TranslatableInfoModel, PlaceTranslation>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.PlaceId, opt => opt.Ignore())
                .ForMember(dest => dest.Place, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TranslatableInfoModel, ExpenseTemplateTranslation>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.ExpenseTemplateId, opt => opt.Ignore())
                .ForMember(dest => dest.ExpenseTemplate, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TranslatableInfoModel, TourNoteTemplateTranslation>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.TourNoteTemplateId, opt => opt.Ignore())
                .ForMember(dest => dest.TourNoteTemplate, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // ---- Entity -> InfoModel (чтение) ----

            CreateMap<AdditionalExpenseTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => (int)src.Type))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TourInfoTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => (int)src.Type))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TourDayInfoTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => (int)src.Type))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у точки маршрута семантически не используется -> константа 0
            CreateMap<RoutePointTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => 0))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у перевода заметки семантически не используется -> константа 0
            // (вид заметки едет отдельным полем TourNoteInfoModel.Type)
            CreateMap<TourNoteTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => 0))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Каталоги 3.4 — у переводов своего Type нет -> константа 0.
            CreateMap<PlaceTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => 0))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<ExpenseTemplateTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => 0))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            CreateMap<TourNoteTemplateTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => 0))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у настройки сайта семантически не используется -> константа 0
            CreateMap<SiteSettingTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => 0))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // У региона Type имеет смысл (RegionTranslationType.Name/Blurb, в отличие от
            // TourNote/RoutePoint/SiteSetting) -> переносится как есть.
            // Только чтение: создание/обновление региона (и его переводов) не входит в 3.2 —
            // регионы приходят сидом (SeedArmenianRegions).
            CreateMap<RegionTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => (int)src.Type))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));
        }

        // Заполняет метаданные ключа из каталога в коде. Ключ, которого нет в каталоге,
        // оставляет метаданные по умолчанию — такой строки в ответе быть не должно,
        // её отсекает слияние в SiteSettingsInfo.
        private static void ApplyCatalogMetadata(SiteSetting source, SiteSettingInfoModel destination)
        {
            var definition = SiteSettingCatalog.ByKey(source.Key);
            if (definition is null)
                return;

            destination.Group = definition.Group;
            destination.ValueType = definition.ValueType;
            destination.IsTranslatable = definition.IsTranslatable;
            destination.IsPublic = definition.IsPublic;
            destination.SortOrder = definition.SortOrder;
        }

        // Собирает TourDetails из списка дней, проставляя порядок (SortOrder).
        // Id дня сохраняется маппингом *->TourDay, поэтому слой обновления
        // корректно сверяет дни по Id.
        private static void BuildTourDetails<TDay>(IList<TDay> days, Tour dest, IRuntimeMapper mapper)
        {
            if (days == null)
                return;

            dest.TourDetails = new HashSet<TourDetail>();

            for (int i = 0; i < days.Count; i++)
            {
                var tourDayEntity = mapper.Map<TourDay>(days[i]);

                dest.TourDetails.Add(new TourDetail
                {
                    Tour = dest,
                    TourDay = tourDayEntity,
                    SortOrder = i
                });
            }
        }
    }
}
