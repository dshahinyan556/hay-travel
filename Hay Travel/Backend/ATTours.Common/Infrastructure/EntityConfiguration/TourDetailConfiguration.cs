using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourDetailConfiguration : IEntityTypeConfiguration<TourDetail>
    {
        public void Configure(EntityTypeBuilder<TourDetail> builder)
        {
            builder.ToTable(nameof(TourDetail));

            builder.HasOne(x => x.Tour)
                .WithMany(t => t.TourDetails)
                .HasForeignKey(t => t.TourId);

            builder.HasOne(x => x.TourDay)
                .WithMany(t => t.TourDetails)
                .HasForeignKey(t => t.TourDayId);

            builder.HasKey(k => new { k.TourId, k.TourDayId });

            builder.Navigation(x => x.TourDay).AutoInclude();
        }
    }
}
