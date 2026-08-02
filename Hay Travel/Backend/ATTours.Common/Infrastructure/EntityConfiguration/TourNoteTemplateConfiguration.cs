using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourNoteTemplateConfiguration : IEntityTypeConfiguration<TourNoteTemplate>
    {
        public void Configure(EntityTypeBuilder<TourNoteTemplate> builder)
        {
            builder.ToTable(nameof(TourNoteTemplate));

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.TourNoteTemplate)
                .HasForeignKey(x => x.TourNoteTemplateId)
                .OnDelete(DeleteBehavior.Cascade);

            // Каталог фильтруется по виду заметки при подборе шаблона в админке.
            builder.HasIndex(x => x.Type);
        }
    }
}
