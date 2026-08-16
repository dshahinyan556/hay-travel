using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TagConfiguration : IEntityTypeConfiguration<Tag>
    {
        public void Configure(EntityTypeBuilder<Tag> builder)
        {
            builder.ToTable(nameof(Tag));

            // Процент — decimal(5,2): достаточно для 0.00–100.00, без риска молчаливого
            // округления, которое SQL Server сделал бы на decimal(18,0) по умолчанию.
            builder.Property(x => x.DiscountPercent)
                .HasPrecision(5, 2);

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.Tag)
                .HasForeignKey(x => x.TagId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
