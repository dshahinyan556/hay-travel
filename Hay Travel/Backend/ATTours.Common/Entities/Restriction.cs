using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(RestrictionConfiguration))]
    public class Restriction : EntityBase
    {
        public int TourId { get; set; }
        public int SortOrder { get; set; }
        public Tour Tour { get; set; }
        public HashSet<RestrictionTranslation> Translations { get; set; } = [];
    }
}
