using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TransferRoutePointConfiguration : IEntityTypeConfiguration<TransferRoutePoint>
    {
        public void Configure(EntityTypeBuilder<TransferRoutePoint> builder)
        {
            builder.ToTable(nameof(TransferRoutePoint));

            builder.HasOne(x => x.Tour)
                .WithMany(x => x.TransferRoutePoints)
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.TransferRoutePoint)
                .HasForeignKey(x => x.TransferRoutePointId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
