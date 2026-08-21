using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class OrderLineConfiguration : IEntityTypeConfiguration<OrderLine>
    {
        public void Configure(EntityTypeBuilder<OrderLine> builder)
        {
            builder.ToTable(nameof(OrderLine));

            builder.HasOne(x => x.Order)
                .WithMany(x => x.Lines)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            // Restrict, как раньше на Order: тур с бронями нельзя удалить молча
            // (TourDeletionService отбивает это заранее явным TourHasOrders).
            builder.HasOne(x => x.Tour)
                .WithMany()
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Restrict);

            // Restrict: сотрудник — обычный User (soft-delete), реальных hard-delete не бывает,
            // но заказ не должен молча остаться без ссылки на исполнителя.
            builder.HasOne(x => x.Employee)
                .WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Property(x => x.TourDate)
                .IsRequired();

            builder.Property(x => x.PrepaymentAmount)
                .HasPrecision(18, 2);
            builder.Property(x => x.PriceSnapshot)
                .HasPrecision(18, 2);
            builder.Property(x => x.DiscountPercent)
                .HasPrecision(5, 2);
            builder.Property(x => x.LineTotal)
                .HasPrecision(18, 2);

            // Календарь занятости читается по (тур, дата) через строки — тот же индекс,
            // что раньше стоял прямо на Order (OrderCalendarInfo.LoadOrderAggregatesAsync).
            builder.HasIndex(x => x.TourDate);
            builder.HasIndex(x => new { x.TourId, x.TourDate });
            builder.HasIndex(x => x.EmployeeId);
        }
    }
}
