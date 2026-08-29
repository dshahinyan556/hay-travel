using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourStartTimeConfiguration : IEntityTypeConfiguration<TourStartTime>
    {
        public void Configure(EntityTypeBuilder<TourStartTime> builder)
        {
            builder.ToTable(nameof(TourStartTime));

            // Cascade: слот без продукта бессмысленен (та же семантика, что у TourNote).
            builder.HasOne(x => x.Tour)
                .WithMany(x => x.StartTimes)
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            // Один и тот же слот дважды на одном продукте — это ошибка ввода, а не два слота:
            // остаток мест группового формата считается по паре (дата + время), дубль
            // расщепил бы одну и ту же квоту на две.
            builder.HasIndex(x => new { x.TourId, x.Time })
                .IsUnique();
        }
    }
}
