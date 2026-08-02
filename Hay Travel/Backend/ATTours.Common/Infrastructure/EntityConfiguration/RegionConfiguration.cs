using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class RegionConfiguration : IEntityTypeConfiguration<Region>
    {
        public void Configure(EntityTypeBuilder<Region> builder)
        {
            builder.ToTable(nameof(Region));

            builder.Property(x => x.Slug)
                .IsRequired()
                .HasMaxLength(64);

            // Слаг — идентичность региона на проводе (фильтр ?region=, ссылка из TourRegionInfoModel).
            builder.HasIndex(x => x.Slug)
                .IsUnique();

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.Region)
                .HasForeignKey(x => x.RegionId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
