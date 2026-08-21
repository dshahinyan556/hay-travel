using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class OrderConfiguration : IEntityTypeConfiguration<Order>
    {
        public void Configure(EntityTypeBuilder<Order> builder)
        {
            builder.ToTable(nameof(Order));

            // Restrict: заказ нельзя осиротить удалением пользователя. Пользователь и так
            // soft-delete (User.IsDeleted). WithMany() без навигации: коллекции Orders на
            // User нет (граф её не читает).
            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Property(x => x.Number)
                .IsRequired()
                .HasMaxLength(20);
            // Человеческий номер уникален (ДДММГГ + счётчик за день, Фаза 1.4).
            builder.HasIndex(x => x.Number)
                .IsUnique();

            builder.Property(x => x.Currency)
                .IsRequired()
                .HasMaxLength(3);

            builder.Property(x => x.RejectReason)
                .HasMaxLength(2000);

            // «Мои заказы» и админские фильтры.
            builder.HasIndex(x => x.UserId);
            builder.HasIndex(x => x.Status);
        }
    }
}
