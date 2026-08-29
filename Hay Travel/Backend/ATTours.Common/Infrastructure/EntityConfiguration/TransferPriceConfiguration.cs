using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    // Связка с двумя родителями — оба FK конфигурируются здесь (как TourTagConfiguration).
    public class TransferPriceConfiguration : IEntityTypeConfiguration<TransferPrice>
    {
        public void Configure(EntityTypeBuilder<TransferPrice> builder)
        {
            builder.ToTable(nameof(TransferPrice));

            builder.HasOne(x => x.Tour)
                .WithMany(x => x.TransferPrices)
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            // Класс авто нельзя удалить, пока он участвует хотя бы в одной цене
            // (как Tag <-> TourTag). Множественных каскадных путей не возникает:
            // владелец (Tour) каскадит, справочник — нет.
            builder.HasOne(x => x.VehicleClass)
                .WithMany(x => x.TransferPrices)
                .HasForeignKey(x => x.VehicleClassId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Property(x => x.OneWayPrice)
                .HasPrecision(18, 2);
            builder.Property(x => x.RoundTripPrice)
                .HasPrecision(18, 2);

            // Один класс авто на одном трансфере — ровно одна строка цен: повторное
            // добавление класса это правка его цен, а не вторая строка.
            builder.HasIndex(x => new { x.TourId, x.VehicleClassId })
                .IsUnique();
        }
    }
}
