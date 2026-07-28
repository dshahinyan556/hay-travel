using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(GalleryImageConfiguration))]
    public class GalleryImage : EntityBase
    {
        public int TourDayId { get; set; }
        public string Url { get; set; }
        public int SortOrder { get; set; }
        public TourDay TourDay { get; set; }
    }
}