using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Слияние Restriction + OrganizationalDetail (ADR 003): структурно они были идентичны,
    // разделяет их теперь только Type.
    // SortOrder уникален В ПРЕДЕЛАХ типа: у тура два независимых диапазона 0..n-1 —
    // свой у орг. деталей, свой у ограничений. Читать всегда как
    // Where(Type == X).OrderBy(SortOrder), никогда OrderBy(SortOrder) по всем заметкам сразу.
    [EntityTypeConfiguration(typeof(TourNoteConfiguration))]
    public class TourNote : EntityBase
    {
        public int TourId { get; set; }
        public TourNoteType Type { get; set; }
        public int SortOrder { get; set; }
        // Ссылка на каталог TourNoteTemplate (3.4). null = свободная запись. При привязке
        // Type обязан совпадать с TourNoteTemplate.Type (правило валидации 3.4.6).
        public int? TourNoteTemplateId { get; set; }
        public TourNoteTemplate TourNoteTemplate { get; set; }
        public Tour Tour { get; set; }
        public HashSet<TourNoteTranslation> Translations { get; set; } = [];
    }
}
