using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class VehicleClassTranslationConfiguration : IEntityTypeConfiguration<VehicleClassTranslation>
    {
        public void Configure(EntityTypeBuilder<VehicleClassTranslation> builder)
        {
            builder.ToTable(nameof(VehicleClassTranslation));

            // Тот же потолок, что у TagTranslation: это короткое название справочника.
            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(100);
        }
    }
}
