using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

// Строчное Dto — как у соседних Create-моделей графа тура (TourCreateModel,
// RestrictionCreateModel до слияния, TourRegionCreateModel).
namespace ATTours.Common.Dto.Init
{
    // Заменяет OrganizationalDetailCreateModel + RestrictionCreateModel (ADR 003).
    // SortOrder — порядок ВНУТРИ своего Type, не сквозной по туру.
    public class TourNoteCreateModel
    {
        public TourNoteType Type { get; set; }
        public int SortOrder { get; set; }
        // Ссылка на каталог TourNoteTemplate (3.4). null = свободная запись без каталога.
        public int? TourNoteTemplateId { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
    }
}
