using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(RoutePointTranslationConfiguration))]
    public class RoutePointTranslation : EntityBase
    {
        public int RoutePointId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public RoutePoint RoutePoint { get; set; }
    }
}
