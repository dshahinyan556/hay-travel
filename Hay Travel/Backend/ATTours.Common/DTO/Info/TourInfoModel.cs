using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    public class TourInfoModel
    {
        public int Id { get; set; }
        public TourType Type { get; set; }
        // Формат проведения (батч 2026-08-29): обязателен у тура/экскурсии, ВСЕГДА null
        // у трансфера (TourValidationService). Копируется в существующий тур вручную —
        // TourUpdateService переносит скаляры поимённо.
        public TourFormat? Format { get; set; }
        // Групповой формат: цена за человека и мест на выезд. Обе обязательны при
        // Format == Group/Both и всегда null при Individual и у трансфера.
        public decimal? GroupPricePerPerson { get; set; }
        public int? GroupCapacity { get; set; }
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
        // Предопределённые времена начала (батч 2026-08-29): минимум одно у тура/экскурсии,
        // ни одного у трансфера. Реконсилятся по Id, как остальные коллекции графа тура
        // (null трактуется как пустой список — «очистить», а не «не трогать»: исключение
        // null/[] есть только у Regions/Tags).
        public List<TourStartTimeInfoModel> StartTimes { get; set; }
        // Только для TourType.Transfer: маршрут «откуда / стопы / куда» и цены по классам авто.
        // У тура и экскурсии обе коллекции обязаны быть пустыми.
        public List<TransferRoutePointInfoModel> TransferRoutePoints { get; set; }
        public List<TransferPriceInfoModel> TransferPrices { get; set; }
    }
}
