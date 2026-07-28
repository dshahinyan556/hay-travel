using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

namespace ATTours.Common.Dto.Init
{
    public class TourCreateModel
    {
        public TourType Type { get; set; }
        public string MainImageUrl { get; set; }
        public bool IsActive { get; set; }
        public List<TourDayCreateModel> TourDays { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
        public List<AdditionalExpenseCreateModel> AdditionalExpenses { get; set; }
        public List<OrganizationalDetailCreateModel> OrganizationalDetails { get; set; }
        public List<RestrictionCreateModel> Restrictions { get; set; }
    }
}
