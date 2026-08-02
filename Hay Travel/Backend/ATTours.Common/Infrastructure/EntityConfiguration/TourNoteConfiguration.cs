using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourNoteConfiguration : IEntityTypeConfiguration<TourNote>
    {
        public void Configure(EntityTypeBuilder<TourNote> builder)
        {
            builder.ToTable(nameof(TourNote));

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.TourNote)
                .HasForeignKey(x => x.TourNoteId)
                .OnDelete(DeleteBehavior.Cascade);

            // Чтение всегда идёт «внутри типа» (Where(Type == X).OrderBy(SortOrder)),
            // поэтому индекс составной. Он же покрывает FK TourId (первая колонка),
            // так что отдельный IX_TourNote_TourId EF не создаёт.
            builder.HasIndex(x => new { x.TourId, x.Type });

            // Ссылка на каталог (3.4). Restrict — см. RoutePointConfiguration.
            builder.HasOne(x => x.TourNoteTemplate)
                .WithMany(x => x.TourNotes)
                .HasForeignKey(x => x.TourNoteTemplateId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
