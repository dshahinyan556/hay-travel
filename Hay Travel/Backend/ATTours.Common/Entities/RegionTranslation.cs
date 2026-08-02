using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(RegionTranslationConfiguration))]
    public class RegionTranslation : EntityBase
    {
        public int RegionId { get; set; }
        // В отличие от RestrictionTranslation/RoutePointTranslation, у региона есть Type:
        // сегодня в продукте уже два текста — название (сидится) и blurb (пока на фронте).
        public RegionTranslationType Type { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public Region Region { get; set; }
    }
}
