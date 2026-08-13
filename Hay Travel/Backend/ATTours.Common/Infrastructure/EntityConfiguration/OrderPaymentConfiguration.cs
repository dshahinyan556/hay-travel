using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class OrderPaymentConfiguration : IEntityTypeConfiguration<OrderPayment>
    {
        public void Configure(EntityTypeBuilder<OrderPayment> builder)
        {
            builder.ToTable(nameof(OrderPayment));

            // Деньги — decimal(18,2), как и любая денежная величина: без явной точности
            // SQL Server взял бы decimal(18,0) и молча округлил бы копейки/лумы.
            builder.Property(x => x.TourPriceSnapshot)
                .HasPrecision(18, 2);

            builder.Property(x => x.TotalAmount)
                .HasPrecision(18, 2);

            builder.Property(x => x.PrepaidAmount)
                .HasPrecision(18, 2);

            builder.Property(x => x.Currency)
                .IsRequired()
                .HasMaxLength(3);

            // Гарантия 1:1 на уровне БД (ADR 014). Саму связь настраивает OrderConfiguration.
            builder.HasIndex(x => x.OrderId)
                .IsUnique();
        }
    }
}
