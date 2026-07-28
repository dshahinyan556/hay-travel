using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(OrganizationalDetailConfiguration))]
    public class OrganizationalDetail : EntityBase
    {
        public int TourId { get; set; }
        public int SortOrder { get; set; }
        public Tour Tour { get; set; }
        public HashSet<OrganizationalDetailTranslation> Translations { get; set; } = [];
    }
}
