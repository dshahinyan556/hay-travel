using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TransferRoutePointTranslationConfiguration : IEntityTypeConfiguration<TransferRoutePointTranslation>
    {
        public void Configure(EntityTypeBuilder<TransferRoutePointTranslation> builder)
        {
            builder.ToTable(nameof(TransferRoutePointTranslation));

            // Тот же потолок, что у RoutePointTranslation — подпись точки маршрута.
            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
