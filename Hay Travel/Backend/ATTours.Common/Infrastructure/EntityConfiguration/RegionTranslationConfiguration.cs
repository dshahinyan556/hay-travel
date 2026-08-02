using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class RegionTranslationConfiguration : IEntityTypeConfiguration<RegionTranslation>
    {
        public void Configure(EntityTypeBuilder<RegionTranslation> builder)
        {
            builder.ToTable(nameof(RegionTranslation));

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(400);
        }
    }
}
