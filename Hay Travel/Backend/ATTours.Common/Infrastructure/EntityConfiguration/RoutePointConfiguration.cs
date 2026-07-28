using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class RoutePointConfiguration : IEntityTypeConfiguration<RoutePoint>
    {
        public void Configure(EntityTypeBuilder<RoutePoint> builder)
        {
            builder.ToTable(nameof(RoutePoint));

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.RoutePoint)
                .HasForeignKey(x => x.RoutePointId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
