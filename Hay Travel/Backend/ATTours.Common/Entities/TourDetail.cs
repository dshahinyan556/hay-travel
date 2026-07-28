using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(TourDetailConfiguration))]
    public class TourDetail : EntityBase
    {
        public int TourId { get; set; }
        public int TourDayId { get; set; }
        public int SortOrder { get; set; }
        public Tour Tour { get; set; }
        public TourDay TourDay { get; set; }
    }
}
