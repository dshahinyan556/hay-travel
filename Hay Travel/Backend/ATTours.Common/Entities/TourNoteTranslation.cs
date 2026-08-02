using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Одно текстовое поле на язык, поэтому собственного Type у перевода нет
    // (как было у RestrictionTranslation/OrganizationalDetailTranslation).
    [EntityTypeConfiguration(typeof(TourNoteTranslationConfiguration))]
    public class TourNoteTranslation : EntityBase
    {
        public int TourNoteId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public TourNote TourNote { get; set; }
    }
}
