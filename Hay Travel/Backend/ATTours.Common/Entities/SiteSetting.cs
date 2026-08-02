using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Настройка сайта: в БД хранится только значение (Key + Value + переводы).
    // Метаданные ключа (группа, тип контрола, переводимость, публичность, порядок,
    // дефолт) живут в коде — SiteSettingCatalog, ADR 002.
    [EntityTypeConfiguration(typeof(SiteSettingConfiguration))]
    public class SiteSetting : EntityBase
    {
        public string Key { get; set; }

        // Язык-нейтральное значение. Nullable: незаполненная настройка — валидное состояние.
        public string Value { get; set; }

        public HashSet<SiteSettingTranslation> Translations { get; set; } = [];
    }
}
