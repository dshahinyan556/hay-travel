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

            // Cascade: удаление строки/заказа целиком (действие "Удалить заказ") забирает и
            // журнал проводок по ней — история платежей отдельно от заказа не хранится.
            builder.HasOne(x => x.OrderLine)
                .WithMany(x => x.Payments)
                .HasForeignKey(x => x.OrderLineId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(x => x.Number)
                .IsRequired()
                .HasMaxLength(20);
            // Автономер сквозной по всей базе, не только внутри заказа.
            builder.HasIndex(x => x.Number)
                .IsUnique();

            builder.Property(x => x.Amount)
                .HasPrecision(18, 2);

            builder.HasIndex(x => x.OrderLineId);
        }
    }
}
