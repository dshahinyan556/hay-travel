using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Текст заметки. Своего Type нет (вид заметки живёт на TourNoteTemplate.Type,
    // как у TourNoteTranslation).
    [EntityTypeConfiguration(typeof(TourNoteTemplateTranslationConfiguration))]
    public class TourNoteTemplateTranslation : EntityBase
    {
        public int TourNoteTemplateId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public TourNoteTemplate TourNoteTemplate { get; set; }
    }
}
