using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // У настройки одно текстовое поле, поэтому Type у перевода нет
    // (как у RestrictionTranslation/RoutePointTranslation) — на чтении маппится константой 0.
    [EntityTypeConfiguration(typeof(SiteSettingTranslationConfiguration))]
    public class SiteSettingTranslation : EntityBase
    {
        public int SiteSettingId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public SiteSetting SiteSetting { get; set; }
    }
}
