using ATTours.Common.Constants;
using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class OrderContactConfiguration : IEntityTypeConfiguration<OrderContact>
    {
        public void Configure(EntityTypeBuilder<OrderContact> builder)
        {
            builder.ToTable(nameof(OrderContact));

            // Cascade — та же семантика, что у OrderLine -> Order: контакт без заказа
            // бессмыслен, а заказ удаляется целиком (OrderDeletionService).
            builder.HasOne(x => x.Order)
                .WithMany(x => x.Contacts)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(ContactLimits.MaxValueLength);

            builder.Property(x => x.FirstName)
                .IsRequired()
                .HasMaxLength(ContactLimits.MaxNameLength);

            builder.Property(x => x.LastName)
                .HasMaxLength(ContactLimits.MaxNameLength);

            builder.HasIndex(x => x.OrderId);
        }
    }
}
