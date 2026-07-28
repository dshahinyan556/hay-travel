using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(RoutePointConfiguration))]
    public class RoutePoint : EntityBase
    {
        public int TourDayId { get; set; }
        public int SortOrder { get; set; }
        public TourDay TourDay { get; set; }
        public HashSet<RoutePointTranslation> Translations { get; set; } = [];
    }
}
