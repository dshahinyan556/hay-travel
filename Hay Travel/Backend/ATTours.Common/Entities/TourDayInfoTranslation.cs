using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(TourDayInfoTranslationConfiguration))]
    public partial class TourDayInfoTranslation : EntityBase
    {
        public TourDayTranslationType Type { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public int TourDayId { get; set; }
        public TourDay TourDay { get; set; }
    }
}
