using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourDayInfoTranslationConfiguration : IEntityTypeConfiguration<TourDayInfoTranslation>
    {
        public void Configure(EntityTypeBuilder<TourDayInfoTranslation> builder)
        {
            builder.ToTable(nameof(TourDayInfoTranslation));
            
            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
