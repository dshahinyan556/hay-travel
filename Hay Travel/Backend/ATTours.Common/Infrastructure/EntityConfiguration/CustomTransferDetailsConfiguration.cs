using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class CustomTransferDetailsConfiguration : IEntityTypeConfiguration<CustomTransferDetails>
    {
        public void Configure(EntityTypeBuilder<CustomTransferDetails> builder)
        {
            builder.ToTable(nameof(CustomTransferDetails));

            // Один-к-одному со строкой заказа: WithOne без коллекции + уникальный FK.
            // Cascade — детали без своей строки бессмысленны (как OrderLineEmployee).
            builder.HasOne(x => x.OrderLine)
                .WithOne(x => x.CustomTransferDetails)
                .HasForeignKey<CustomTransferDetails>(x => x.OrderLineId)
                .OnDelete(DeleteBehavior.Cascade);

            // Restrict: класс авто — справочник, удалять его вместе с заявкой нельзя
            // (и заявка не должна молча потерять пожелание клиента).
            builder.HasOne(x => x.DesiredVehicleClass)
                .WithMany()
                .HasForeignKey(x => x.DesiredVehicleClassId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(x => x.Stops)
                .WithOne(x => x.CustomTransferDetails)
                .HasForeignKey(x => x.CustomTransferDetailsId)
                .OnDelete(DeleteBehavior.Cascade);

            // LuggageOther/Comment — без HasMaxLength (nvarchar(max)): свободный текст
            // клиента без осмысленного потолка (как PickupDetails у OrderLineEmployee).
        }
    }
}
