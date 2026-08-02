using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourNoteTranslationConfiguration : IEntityTypeConfiguration<TourNoteTranslation>
    {
        public void Configure(EntityTypeBuilder<TourNoteTranslation> builder)
        {
            builder.ToTable(nameof(TourNoteTranslation));

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
