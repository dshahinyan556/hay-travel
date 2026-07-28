using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class GalleryImageConfiguration : IEntityTypeConfiguration<GalleryImage>
    {
        public void Configure(EntityTypeBuilder<GalleryImage> builder)
        {
            builder.ToTable(nameof(GalleryImage));

            builder.Property(x => x.Url)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
