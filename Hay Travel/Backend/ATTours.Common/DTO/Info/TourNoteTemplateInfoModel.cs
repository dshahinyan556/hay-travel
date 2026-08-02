using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    public class TourNoteTemplateInfoModel
    {
        public int Id { get; set; }
        public TourNoteType Type { get; set; }
        public int SortOrder { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
