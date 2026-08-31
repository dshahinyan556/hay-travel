namespace ATTours.Common.Constants
{
    // Ширины колонок личных предпочтений пользователя (2026-08-29). Вынесены сюда, а не
    // повторены литералами в UserConfiguration и в валидации: без общей константы длина
    // колонки и длина, которую проверяет сервер, разъезжаются, и слишком длинное значение
    // падает уже SqlException'ом на INSERT вместо честного 400 (ровно эта развилка описана
    // в UserPhoneUpdateService).
    public static class UserPreferenceLimits
    {
        // "dark" / "light". Допустимые значения задаёт не длина, а ключ настроек
        // theme.defaultMode (SiteSettingCatalog) — запас на случай третьего режима.
        public const int MaxThemeLength = 16;

        // Id пресета палитры. Допустимые значения — ThemePaletteCatalog.IsKnown, здесь
        // только физический потолок колонки.
        public const int MaxPaletteLength = 32;

        // ISO-4217: ровно три буквы, ни больше ни меньше (CurrencyCatalog).
        public const int CurrencyCodeLength = 3;
    }
}
