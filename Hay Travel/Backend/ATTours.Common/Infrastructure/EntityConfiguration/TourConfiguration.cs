using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourConfiguration : IEntityTypeConfiguration<Tour>
    {
        public void Configure(EntityTypeBuilder<Tour> builder)
        {
            builder.ToTable(nameof(Tour));

            builder.HasMany(x => x.AdditionalExpenses)
                .WithOne(a => a.Tour)
                .HasForeignKey(a => a.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.Translations)
                .WithOne(a => a.Tour)
                .HasForeignKey(a => a.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.OrganizationalDetails)
                .WithOne(x => x.Tour)
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.Restrictions)
                .WithOne(x => x.Tour)
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(a => a.TotalPrice)
                .HasPrecision(18, 2);

            builder.Property(a => a.MainImageUrl)
                .IsRequired()
                .HasMaxLength(4000);

            builder.HasIndex(t => t.Type);
            builder.HasIndex(t => t.TotalPrice);
            builder.HasIndex(t => t.IsArchived);
        }
    }
}
