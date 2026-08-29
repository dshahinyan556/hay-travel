using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

namespace ATTours.Common.Dto.Init
{
    public class TourCreateModel
    {
        public TourType Type { get; set; }
        // Формат проведения (батч 2026-08-29): обязателен у тура/экскурсии, всегда null
        // у трансфера. Групповые поля обязательны при Format == Group/Both.
        public TourFormat? Format { get; set; }
        public decimal? GroupPricePerPerson { get; set; }
        public int? GroupCapacity { get; set; }
        public string MainImageUrl { get; set; }
        public bool IsActive { get; set; }
        public bool RequiresPrepayment { get; set; }
        // Скидка задаётся тройкой: процент + диапазон дат [start; end]. Либо все три поля,
        // либо ни одного (TourValidationService.ValidateDiscount).
        public decimal? DiscountPercent { get; set; }
        public DateOnly? DiscountStartDate { get; set; }
        public DateOnly? DiscountValidUntil { get; set; }
        public List<TourDayCreateModel> TourDays { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
        public List<AdditionalExpenseCreateModel> AdditionalExpenses { get; set; }
        // Один список вместо OrganizationalDetails + Restrictions (ADR 003): вид заметки
        // задаёт Type, SortOrder считается внутри своего Type.
        public List<TourNoteCreateModel> Notes { get; set; }
        public List<TourRegionCreateModel> Regions { get; set; }
        public List<TourTagCreateModel> Tags { get; set; }
        // Времена начала (минимум одно у тура/экскурсии, ни одного у трансфера).
        public List<TourStartTimeCreateModel> StartTimes { get; set; }
        // Только для TourType.Transfer (решение 0.4/0.6).
        public List<TransferRoutePointCreateModel> TransferRoutePoints { get; set; }
        public List<TransferPriceCreateModel> TransferPrices { get; set; }
    }
}
