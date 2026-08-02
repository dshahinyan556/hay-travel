using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Заменяет OrganizationalDetailInfoModel + RestrictionInfoModel (ADR 003).
    // SortOrder — порядок ВНУТРИ своего Type, не сквозной по туру.
    public class TourNoteInfoModel
    {
        public int Id { get; set; }
        public TourNoteType Type { get; set; }
        public int SortOrder { get; set; }
        // Ссылка на каталог TourNoteTemplate (3.4). null = свободная запись без каталога.
        public int? TourNoteTemplateId { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
