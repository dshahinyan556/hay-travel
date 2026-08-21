using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class OrderEventConfiguration : IEntityTypeConfiguration<OrderEvent>
    {
        public void Configure(EntityTypeBuilder<OrderEvent> builder)
        {
            builder.ToTable(nameof(OrderEvent));

            // Cascade: удаление заказа целиком уносит и его историю. Журнал осиротевшего
            // заказа никому не показывается — отдельного архива удалённых заказов нет
            // (поэтому же само удаление заказа не логируется, ADR 020 §5).
            builder.HasOne(x => x.Order)
                .WithMany()
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(x => x.Description)
                .IsRequired()
                .HasMaxLength(1000);

            builder.Property(x => x.ActorFullName)
                .HasMaxLength(200);

            builder.Property(x => x.CreatedAtUtc)
                .IsRequired();

            // История всегда читается точечно, по одному заказу, отсортированной по времени.
            builder.HasIndex(x => new { x.OrderId, x.CreatedAtUtc });
        }
    }
}
