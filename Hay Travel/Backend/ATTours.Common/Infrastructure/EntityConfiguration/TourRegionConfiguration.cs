using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    // Join-сущность с двумя родителями — оба FK конфигурируются здесь (не в TourConfiguration),
    // так как у них разное поведение при удалении.
    public class TourRegionConfiguration : IEntityTypeConfiguration<TourRegion>
    {
        public void Configure(EntityTypeBuilder<TourRegion> builder)
        {
            builder.ToTable(nameof(TourRegion));

            builder.HasOne(x => x.Tour)
                .WithMany(x => x.TourRegions)
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            // Regions нельзя удалить, пока он используется хотя бы в одном туре.
            builder.HasOne(x => x.Region)
                .WithMany(x => x.TourRegions)
                .HasForeignKey(x => x.RegionId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(x => new { x.TourId, x.RegionId })
                .IsUnique();
        }
    }
}
