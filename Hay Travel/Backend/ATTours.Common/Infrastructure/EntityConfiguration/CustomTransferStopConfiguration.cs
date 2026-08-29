using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class CustomTransferStopConfiguration : IEntityTypeConfiguration<CustomTransferStop>
    {
        public void Configure(EntityTypeBuilder<CustomTransferStop> builder)
        {
            builder.ToTable(nameof(CustomTransferStop));

            // Тот же потолок, что у подписей точек маршрута (RoutePointTranslation).
            builder.Property(x => x.Text)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
