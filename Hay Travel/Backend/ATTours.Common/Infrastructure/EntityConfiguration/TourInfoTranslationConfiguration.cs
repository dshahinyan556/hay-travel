using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourInfoTranslationConfiguration : IEntityTypeConfiguration<TourInfoTranslation>
    {
        public void Configure(EntityTypeBuilder<TourInfoTranslation> builder)
        {
            builder.ToTable(nameof(TourInfoTranslation));

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
