using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourDayConfiguration : IEntityTypeConfiguration<TourDay>
    {
        public void Configure(EntityTypeBuilder<TourDay> builder)
        {
            builder.ToTable(nameof(TourDay));

            builder.Property(a => a.Price)
                .IsRequired()
                .HasPrecision(18, 2);

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.TourDay)
                .HasForeignKey(x => x.TourDayId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.GalleryImages)
                .WithOne(x => x.TourDay)
                .HasForeignKey(x => x.TourDayId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.RoutePoints)
                .WithOne(x => x.TourDay)
                .HasForeignKey(x => x.TourDayId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Navigation(x => x.GalleryImages).AutoInclude();
            builder.Navigation(x => x.RoutePoints).AutoInclude();
        }
    }
}
