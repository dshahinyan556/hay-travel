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

            // Restrict на обоих FK намеренно: заказ нельзя осиротить удалением тура или
            // пользователя. Пользователь и так soft-delete (User.IsDeleted), а hard-delete
            // тура с заказами отбивается заранее внятным кодом TourHasOrders
            // (TourDeletionService) — иначе наружу ушло бы сырое FK-нарушение.
            // WithMany() без навигации: коллекций Orders на User/Tour нет (граф их не читает).
            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(x => x.Tour)
                .WithMany()
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Restrict);

            // Деньги заказа живут вместе с заказом и умирают вместе с ним (ADR 014).
            // Обратная сторона 1:1 настраивается здесь и НЕ дублируется в OrderPaymentConfiguration.
            builder.HasOne(x => x.Payment)
                .WithOne(x => x.Order)
                .HasForeignKey<OrderPayment>(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            // TourDate — DateOnly, колонка date подхватывается конвенцией EF.
            builder.Property(x => x.TourDate)
                .IsRequired();

            // Календарь читается помесячно по дате и по паре (тур, дата) — это его горячий путь.
            builder.HasIndex(x => x.TourDate);
            builder.HasIndex(x => new { x.TourId, x.TourDate });
            // «Мои заказы» и админские фильтры.
            builder.HasIndex(x => x.UserId);
            builder.HasIndex(x => x.Status);
        }
    }
}
