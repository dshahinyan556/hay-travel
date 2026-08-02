using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class PlaceConfiguration : IEntityTypeConfiguration<Place>
    {
        public void Configure(EntityTypeBuilder<Place> builder)
        {
            builder.ToTable(nameof(Place));

            builder.Property(x => x.Slug)
                .IsRequired()
                .HasMaxLength(64);

            // Слаг — внешне-адресуемая идентичность точки (дедуп-гард, ссылка с карты).
            builder.HasIndex(x => x.Slug)
                .IsUnique();

            builder.Property(x => x.Latitude)
                .HasPrecision(9, 6);

            builder.Property(x => x.Longitude)
                .HasPrecision(9, 6);

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.Place)
                .HasForeignKey(x => x.PlaceId)
                .OnDelete(DeleteBehavior.Cascade);

            // Регион нельзя удалить, пока он используется хотя бы одной точкой (как TourRegion->Region).
            builder.HasOne(x => x.Region)
                .WithMany()
                .HasForeignKey(x => x.RegionId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
