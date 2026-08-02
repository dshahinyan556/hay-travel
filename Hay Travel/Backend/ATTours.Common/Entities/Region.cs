using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(RegionConfiguration))]
    public class Region : EntityBase
    {
        // Совпадает с RegionSlug на фронте (Frontend/src/shared/data/armeniaRegions.ts).
        public string Slug { get; set; }
        public int SortOrder { get; set; }
        public HashSet<RegionTranslation> Translations { get; set; } = [];
        public HashSet<TourRegion> TourRegions { get; set; } = [];
    }
}
