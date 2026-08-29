using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Подпись точки маршрута трансфера (RU/EN) — по образцу RoutePointTranslation.
    [EntityTypeConfiguration(typeof(TransferRoutePointTranslationConfiguration))]
    public class TransferRoutePointTranslation : EntityBase
    {
        public int TransferRoutePointId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public TransferRoutePoint TransferRoutePoint { get; set; }
    }
}
