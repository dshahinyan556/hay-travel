using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class PlaceTranslationConfiguration : IEntityTypeConfiguration<PlaceTranslation>
    {
        public void Configure(EntityTypeBuilder<PlaceTranslation> builder)
        {
            builder.ToTable(nameof(PlaceTranslation));

            // Имя точки — короткий текст, как RegionTranslation.
            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(400);
        }
    }
}
