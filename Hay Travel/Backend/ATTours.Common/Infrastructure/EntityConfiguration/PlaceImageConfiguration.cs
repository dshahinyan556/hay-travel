using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class PlaceImageConfiguration : IEntityTypeConfiguration<PlaceImage>
    {
        public void Configure(EntityTypeBuilder<PlaceImage> builder)
        {
            builder.ToTable(nameof(PlaceImage));

            builder.Property(x => x.Url)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
