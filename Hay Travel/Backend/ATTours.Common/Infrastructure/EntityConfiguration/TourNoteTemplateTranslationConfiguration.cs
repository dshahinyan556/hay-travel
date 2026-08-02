using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourNoteTemplateTranslationConfiguration : IEntityTypeConfiguration<TourNoteTemplateTranslation>
    {
        public void Configure(EntityTypeBuilder<TourNoteTemplateTranslation> builder)
        {
            builder.ToTable(nameof(TourNoteTemplateTranslation));

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
