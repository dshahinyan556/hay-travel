using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Каталог переиспользуемых текстов заметок тура (3.4). Слага не имеет — внутренний
    // шаблон, адресуется по Id. Type переиспользует TourNoteType из 3.3: привязать заметку
    // можно только к шаблону совпадающего типа (правило валидации 3.4.6).
    [EntityTypeConfiguration(typeof(TourNoteTemplateConfiguration))]
    public class TourNoteTemplate : EntityBase
    {
        public TourNoteType Type { get; set; }
        public int SortOrder { get; set; }
        public HashSet<TourNoteTemplateTranslation> Translations { get; set; } = [];
        // Inverse — для конфигурации FK (Restrict) и проверки «в использовании» при удалении.
        public HashSet<TourNote> TourNotes { get; set; } = [];
    }
}
