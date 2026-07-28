using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(RestrictionTranslationConfiguration))]
    public class RestrictionTranslation : EntityBase
    {
        public int RestrictionId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public Restriction Restriction { get; set; }
    }
}
