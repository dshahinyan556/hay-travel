using ATTours.Common.DTO.Init;

namespace ATTours.Common.Dto.Init
{
    public class RestrictionCreateModel
    {
        public int SortOrder { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
    }
}
