using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(TourInfoTranslationConfiguration))]
    public partial class TourInfoTranslation : EntityBase
    {
        public TourTranslationType Type { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public int TourId { get; set; }
        public virtual Tour Tour { get; set; }
    }
}
