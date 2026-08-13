namespace ATTours.Common.Infrastructure.SiteSettings
{
    // Одна допустимая опция настройки с ValueType.Select. Живёт в коде рядом
    // с SiteSettingDefinition: состав опций — часть каталога, а не данные (ADR 013).
    public class SiteSettingOption
    {
        public SiteSettingOption(string value, string label)
        {
            Value = value;
            Label = label;
        }

        // Технический id, который уходит в SiteSetting.Value (например "obsidian", "dark").
        public string Value { get; }

        // Подпись для админки (например "Обсидиан + золото", "Тёмная"). Admin-facing,
        // на публичный сайт не уходит, поэтому простая строка, а не перевод.
        public string Label { get; }
    }
}
