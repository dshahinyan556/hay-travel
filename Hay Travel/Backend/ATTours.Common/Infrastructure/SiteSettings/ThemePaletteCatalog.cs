namespace ATTours.Common.Infrastructure.SiteSettings
{
    // Единственный источник правды по допустимым id пресетов палитры (ADR 013).
    // Реальные цвета пресета живут в CSS фронта, здесь — только id и подпись для админки.
    public static class ThemePaletteCatalog
    {
        // Новый пресет = одна строка сюда + соответствующий CSS на фронте, без миграции.
        // "basalt" — id, зашитый во фронте (shared/lib/palette.ts, PALETTE_IDS) реализацией
        // Spec 006; не дефолт (theme.activePalette по умолчанию — "obsidian").
        //
        // Временные превью-пресеты (2026-08-14): 6 вариантов оттенка золота/меди — по три на
        // "Обсидиан" и на "Базальт", каждый идентичен своей базовой палитре и отличается только
        // золотым/медным акцентом. Нужны, чтобы Давид переключал их прямо в /admin/settings и
        // смотрел вживую на реальном сайте, а не по статичному превью. Убрать все шесть (и
        // соответствующие блоки в palettes.css) сразу после того, как он выберет постоянный
        // оттенок — они не предназначены остаться в проде.
        private static readonly IReadOnlyList<SiteSettingOption> palettes =
        [
            new("obsidian", "Обсидиан + золото"),
            new("basalt", "Базальт и медь"),
            new("obsidian-champagne", "Превью: Обсидиан — шампань"),
            new("obsidian-brass", "Превью: Обсидиан — старая латунь"),
            new("obsidian-rosegold", "Превью: Обсидиан — розовое золото"),
            new("basalt-terracotta", "Превью: Базальт — терракота"),
            new("basalt-warmcopper", "Превью: Базальт — тёплая медь"),
            new("basalt-rust", "Превью: Базальт — глубокая ржавчина"),
        ];

        // Отдаётся как Options для ключа theme.activePalette.
        public static IReadOnlyList<SiteSettingOption> Options => palettes;

        // Id пресета — часть контракта с CSS фронта, поэтому сравнение точное (Ordinal).
        public static bool IsKnown(string id) =>
            id is not null && palettes.Any(palette => string.Equals(palette.Value, id, StringComparison.Ordinal));
    }
}
