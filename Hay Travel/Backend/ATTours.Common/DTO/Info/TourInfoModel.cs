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
        public decimal? TotalPrice { get; set; }
        public string MainImageUrl { get; set; }
        public List<TourDayInfoModel> TourDays { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
        public List<AdditionalExpenseInfoModel> AdditionalExpenses { get; set; }
        public List<OrganizationalDetailInfoModel> OrganizationalDetails { get; set; }
        public List<RestrictionInfoModel> Restrictions { get; set; }
    }
}
