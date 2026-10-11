using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourAutoCloseOverrideConfiguration : IEntityTypeConfiguration<TourAutoCloseOverride>
    {
        public void Configure(EntityTypeBuilder<TourAutoCloseOverride> builder)
        {
            builder.ToTable(nameof(TourAutoCloseOverride));

            // Cascade: исключение без продукта бессмысленно (та же семантика, что у
            // TourStartTime). Обратной навигации на Tour сознательно НЕТ: коллекция на Tour
            // втянула бы эту таблицу в граф продукта, а вместе с ним — в TourUpdateService,
            // от которого исключение как раз и отделяли.
            builder.HasOne(x => x.Tour)
                .WithMany()
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            // Уникальность — не «на всякий случай»: резолвер порога строит по этой таблице
            // словарь TourId -> часы, и второй строкой на тот же продукт он бы просто упал
            // (или, что хуже, взял произвольную из двух).
            builder.HasIndex(x => x.TourId)
                .IsUnique();
        }
    }
}
