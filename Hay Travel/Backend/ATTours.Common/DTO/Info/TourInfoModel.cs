using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    public class TourInfoModel
    {
        public int Id { get; set; }
        public TourType Type { get; set; }
        public bool IsActive { get; set; }
        public bool IsArchived { get; set; }
        // Управляется отдельным SetFeatured (как IsActive/IsArchived) — UpdateTour их игнорирует.
        public bool IsFeatured { get; set; }
        public int FeaturedSortOrder { get; set; }
        public bool RequiresPrepayment { get; set; }
        public decimal? TotalPrice { get; set; }
        // Скидка тура (Фаза 3): сырые поля — то, что реально хранится и что редактирует
        // админ. Все три заданы или все три null (TourValidationService). Скидка активна
        // в диапазоне [DiscountStartDate; DiscountValidUntil] включительно — эти же поля
        // клиентский сайт использует для ленты «-N%» в календаре бронирования.
        public decimal? DiscountPercent { get; set; }
        public DateOnly? DiscountStartDate { get; set; }
        public DateOnly? DiscountValidUntil { get; set; }
        // Резолвнутая цена со скидкой — null, если скидки нет, она ещё не началась или уже истекла.
        // Считается на бэке (MappingProfile), чтобы клиент не дублировал дата-логику.
        public decimal? DiscountedPrice { get; set; }
        public string MainImageUrl { get; set; }
        public List<TourDayInfoModel> TourDays { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
        public List<AdditionalExpenseInfoModel> AdditionalExpenses { get; set; }
        // Один список вместо OrganizationalDetails + Restrictions (ADR 003): вид заметки
        // задаёт Type, SortOrder считается внутри своего Type.
        public List<TourNoteInfoModel> Notes { get; set; }
        // Regions == null (поле отсутствует в запросе UpdateTour) — не трогать регионы тура;
        // Regions == [] — очистить все. Осознанная асимметрия с остальными коллекциями графа
        // тура, см. backend-stage3-architecture.md §3.2.9. Снять после этапа 4.4.
        public List<TourRegionInfoModel> Regions { get; set; }
        // Тот же null/[] контракт, что у Regions: null — не трогать теги тура, [] — очистить
        // все. Максимум 3 тега, максимум 1 Discount — TourValidationService.
        public List<TourTagInfoModel> Tags { get; set; }
    }
}
