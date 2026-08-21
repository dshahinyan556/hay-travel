using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    public class TagInfoModel
    {
        public int Id { get; set; }
        public TagType Type { get; set; }
        public TagColor Color { get; set; }
        public int SortOrder { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
