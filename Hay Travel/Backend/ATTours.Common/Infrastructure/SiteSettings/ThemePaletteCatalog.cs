namespace ATTours.Common.Infrastructure.SiteSettings
{
    // Единственный источник правды по допустимым id пресетов палитры (ADR 013).
    // Реальные цвета пресета живут в CSS фронта, здесь — только id и подпись для админки.
    public static class ThemePaletteCatalog
    {
        // Новый пресет = одна строка сюда + соответствующий CSS на фронте, без миграции.
        // "basalt" — id, зашитый во фронте (shared/lib/palette.ts, PALETTE_IDS) реализацией
        // Spec 006; не дефолт (theme.activePalette по умолчанию — "obsidian").
        private static readonly IReadOnlyList<SiteSettingOption> palettes =
        [
            new("obsidian", "Обсидиан + золото"),
            new("basalt", "Базальт и медь"),
        ];

        // Отдаётся как Options для ключа theme.activePalette.
        public static IReadOnlyList<SiteSettingOption> Options => palettes;

        // Id пресета — часть контракта с CSS фронта, поэтому сравнение точное (Ordinal).
        public static bool IsKnown(string id) =>
            id is not null && palettes.Any(palette => string.Equals(palette.Value, id, StringComparison.Ordinal));
    }
}
