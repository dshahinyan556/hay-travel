using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

namespace ATTours.Common.Dto.Init
{
    public class TourCreateModel
    {
        public TourType Type { get; set; }
        public string MainImageUrl { get; set; }
        public bool IsActive { get; set; }
        public bool RequiresPrepayment { get; set; }
        public List<TourDayCreateModel> TourDays { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
        public List<AdditionalExpenseCreateModel> AdditionalExpenses { get; set; }
        // Один список вместо OrganizationalDetails + Restrictions (ADR 003): вид заметки
        // задаёт Type, SortOrder считается внутри своего Type.
        public List<TourNoteCreateModel> Notes { get; set; }
        public List<TourRegionCreateModel> Regions { get; set; }
    }
}
