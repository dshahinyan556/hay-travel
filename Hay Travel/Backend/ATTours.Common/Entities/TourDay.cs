using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(TourDayConfiguration))]
    public class TourDay : EntityBase
    {
        public decimal Price { get; set; }
        public HashSet<TourDayInfoTranslation> Translations { get; set; } = [];
        public HashSet<GalleryImage> GalleryImages { get; set; } = [];
        public HashSet<RoutePoint> RoutePoints { get; set; } = [];
        public HashSet<TourDetail> TourDetails { get; set; } = [];
    }
}