using ATTours.Common.Enums;

namespace ATTours.Common.Infrastructure.SiteSettings
{
    // Метаданные одного ключа настройки. Живут в коде, а не в БД (ADR 002):
    // они никем не редактируются, а IsPublic — свойство безопасности, которое
    // не должно переключаться тумблером из админки.
    public class SiteSettingDefinition
    {
        public SiteSettingDefinition(
            string key,
            SiteSettingGroup group,
            SettingValueType valueType,
            bool isTranslatable,
            bool isPublic,
            int sortOrder,
            string defaultValue = "",
            IReadOnlyDictionary<LanguageCode, string> defaultTranslations = null,
            IReadOnlyList<SiteSettingOption> options = null)
        {
            Key = key;
            Group = group;
            ValueType = valueType;
            IsTranslatable = isTranslatable;
            IsPublic = isPublic;
            SortOrder = sortOrder;
            DefaultValue = defaultValue;
            DefaultTranslations = defaultTranslations ?? new Dictionary<LanguageCode, string>();
            Options = options ?? [];
        }

        // Уникальный ключ вида <группа>.<camelCase>, например hero.imageUrl.
        public string Key { get; }

        public SiteSettingGroup Group { get; }

        public SettingValueType ValueType { get; }

        // Переводимая настройка — та, у которой текст зависит от языка.
        // Ссылки, телефоны и картинки язык-нейтральны.
        public bool IsTranslatable { get; }

        // Отдаётся ли ключ публичным эндпоинтом GetPublic.
        public bool IsPublic { get; }

        // Глобальный порядок отображения в админке (порядок строк каталога).
        public int SortOrder { get; }

        // Значение, которое отдаётся, пока настройка не заполнена. Не null,
        // чтобы GetPublic никогда не возвращал null для известного ключа.
        public string DefaultValue { get; }

        // Дефолты по языкам для переводимых ключей.
        public IReadOnlyDictionary<LanguageCode, string> DefaultTranslations { get; }

        // Допустимые опции для ValueType.Select. Пусто для всех остальных типов.
        public IReadOnlyList<SiteSettingOption> Options { get; }
    }
}
