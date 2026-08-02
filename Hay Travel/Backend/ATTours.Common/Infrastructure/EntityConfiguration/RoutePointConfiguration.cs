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

            // Ссылка на каталог (3.4). Restrict, а не SetNull: обнуление FK у «привязанной,
            // не переопределённой» точки потеряло бы её текст. Множественных каскадных путей
            // не возникает — владелец (TourDay) каскадит, шаблон Place не каскадит.
            builder.HasOne(x => x.Place)
                .WithMany(x => x.RoutePoints)
                .HasForeignKey(x => x.PlaceId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
