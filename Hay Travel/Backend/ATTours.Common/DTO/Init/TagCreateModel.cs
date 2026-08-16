using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

namespace ATTours.Common.Dto.Init
{
    public class TagCreateModel
    {
        public TagType Type { get; set; }
        public TagColor Color { get; set; }
        public decimal? DiscountPercent { get; set; }
        public int SortOrder { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
    }
}
