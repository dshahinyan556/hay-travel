using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Цена предопределённого трансфера для одного класса авто (батч 2026-08-29, решение 0.6).
    // Цена трансфера не хранится в Tour.TotalPrice: у одного трансфера столько цен, сколько
    // на нём заведено классов авто.
    [EntityTypeConfiguration(typeof(TransferPriceConfiguration))]
    public class TransferPrice : EntityBase
    {
        public int TourId { get; set; }
        public int VehicleClassId { get; set; }
        // Цена в одну сторону.
        public decimal OneWayPrice { get; set; }
        // Цена «туда-обратно» — отдельное поле, которое задаёт админ, а НЕ OneWayPrice × 2
        // (решение 0.6): обратный рейс обычно продаётся дешевле двух отдельных.
        public decimal RoundTripPrice { get; set; }
        public Tour Tour { get; set; }
        public VehicleClass VehicleClass { get; set; }
    }
}
