using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Init;
using ATTours.Common.Entities;
using ATTours.Common.Enums;

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
                .ForMember(dest => dest.TotalPrice, opt => opt.MapFrom(src => src.TotalPrice))
                .ForMember(dest => dest.MainImageUrl, opt => opt.MapFrom(src => src.MainImageUrl))
                .ForMember(dest => dest.Translations,
                    opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.AdditionalExpenses,
                    opt => opt.MapFrom(src => src.AdditionalExpenses))
                .ForMember(dest => dest.OrganizationalDetails,
                    opt => opt.MapFrom(src => src.OrganizationalDetails.OrderBy(od => od.SortOrder)))
                .ForMember(dest => dest.Restrictions,
                    opt => opt.MapFrom(src => src.Restrictions.OrderBy(r => r.SortOrder)))
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
                .ForMember(dest => dest.OrganizationalDetails, opt => opt.MapFrom(src => src.OrganizationalDetails))
                .ForMember(dest => dest.Restrictions, opt => opt.MapFrom(src => src.Restrictions))
                .AfterMap((src, dest, context) => BuildTourDetails(src.TourDays, dest, context.Mapper));

            // TourInfoModel -> Tour (для обновления)
            CreateMap<TourInfoModel, Tour>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.MainImageUrl, opt => opt.MapFrom(src => src.MainImageUrl))
                .ForMember(dest => dest.TotalPrice, opt => opt.Ignore())
                .ForMember(dest => dest.IsActive, opt => opt.Ignore())
                .ForMember(dest => dest.TourDetails, opt => opt.Ignore())
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations))
                .ForMember(dest => dest.AdditionalExpenses, opt => opt.MapFrom(src => src.AdditionalExpenses))
                .ForMember(dest => dest.OrganizationalDetails, opt => opt.MapFrom(src => src.OrganizationalDetails))
                .ForMember(dest => dest.Restrictions, opt => opt.MapFrom(src => src.Restrictions))
                .AfterMap((src, dest, context) => BuildTourDetails(src.TourDays, dest, context.Mapper));

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
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // RoutePointCreateModel -> RoutePoint
            CreateMap<RoutePointCreateModel, RoutePoint>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourDayId, opt => opt.Ignore())
                .ForMember(dest => dest.TourDay, opt => opt.Ignore())
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // RoutePointInfoModel -> RoutePoint (для обновления)
            CreateMap<RoutePointInfoModel, RoutePoint>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.TourDayId, opt => opt.Ignore())
                .ForMember(dest => dest.TourDay, opt => opt.Ignore())
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ============= Mappings for ORGANIZATIONALDETAIL =============

            // OrganizationalDetail -> OrganizationalDetailInfoModel
            CreateMap<OrganizationalDetail, OrganizationalDetailInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // OrganizationalDetailCreateModel -> OrganizationalDetail
            CreateMap<OrganizationalDetailCreateModel, OrganizationalDetail>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // OrganizationalDetailInfoModel -> OrganizationalDetail (для обновления)
            CreateMap<OrganizationalDetailInfoModel, OrganizationalDetail>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ============= Mappings for RESTRICTION =============

            // Restriction -> RestrictionInfoModel
            CreateMap<Restriction, RestrictionInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // RestrictionCreateModel -> Restriction
            CreateMap<RestrictionCreateModel, Restriction>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // RestrictionInfoModel -> Restriction (для обновления)
            CreateMap<RestrictionInfoModel, Restriction>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.SortOrder, opt => opt.MapFrom(src => src.SortOrder))
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // ============= Mappings for ADDITIONALEXPENSE =============

            // AdditionalExpense -> AdditionalExpenseInfoModel
            CreateMap<AdditionalExpense, AdditionalExpenseInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Amount, opt => opt.MapFrom(src => src.Amount))
                .ForMember(dest => dest.Translations,
                    opt => opt.MapFrom(src => src.Translations));

            // AdditionalExpenseCreateModel -> AdditionalExpense
            CreateMap<AdditionalExpenseCreateModel, AdditionalExpense>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
                .ForMember(dest => dest.Translations, opt => opt.MapFrom(src => src.Translations));

            // AdditionalExpenseInfoModel -> AdditionalExpense (for update)
            CreateMap<AdditionalExpenseInfoModel, AdditionalExpense>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Amount, opt => opt.MapFrom(src => src.Amount))
                .ForMember(dest => dest.TourId, opt => opt.Ignore())
                .ForMember(dest => dest.Tour, opt => opt.Ignore())
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

            // Type у организационной детали семантически не используется (игнорируется)
            CreateMap<TranslatableCreateModel, OrganizationalDetailTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.OrganizationalDetailId, opt => opt.Ignore())
                .ForMember(dest => dest.OrganizationalDetail, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у ограничения семантически не используется (игнорируется)
            CreateMap<TranslatableCreateModel, RestrictionTranslation>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.RestrictionId, opt => opt.Ignore())
                .ForMember(dest => dest.Restriction, opt => opt.Ignore())
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

            // Type у организационной детали семантически не используется (игнорируется)
            CreateMap<TranslatableInfoModel, OrganizationalDetailTranslation>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.OrganizationalDetailId, opt => opt.Ignore())
                .ForMember(dest => dest.OrganizationalDetail, opt => opt.Ignore())
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у ограничения семантически не используется (игнорируется)
            CreateMap<TranslatableInfoModel, RestrictionTranslation>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.RestrictionId, opt => opt.Ignore())
                .ForMember(dest => dest.Restriction, opt => opt.Ignore())
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

            // Type у организационной детали семантически не используется -> константа 0
            CreateMap<OrganizationalDetailTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => 0))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));

            // Type у ограничения семантически не используется -> константа 0
            CreateMap<RestrictionTranslation, TranslatableInfoModel>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => 0))
                .ForMember(dest => dest.LanguageCode, opt => opt.MapFrom(src => src.LanguageCode))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Value));
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
