using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Account
{
    // Перезапись личных предпочтений (PUT api/Account/Preferences).
    //
    // ВНИМАНИЕ, ЧИТАТЕЛЬ: это ПОЛНАЯ перезапись, а не патч. null в поле означает
    // «сбросить к дефолту сайта», а НЕ «не менять» — фронт всегда держит весь набор в
    // памяти и присылает его целиком. Если когда-нибудь понадобится семантика «не менять»,
    // её нужно заводить отдельным эндпоинтом (PATCH), а не перетолковывать null здесь:
    // иначе сброс темы к дефолту станет невыразимым.
    //
    // UserId нет и быть не может: пользователь берётся только из токена (эндпоинт
    // self-service, как и весь AccountController).
    public class UpdatePreferencesModel
    {
        // "dark" / "light"; null = дефолт сайта (theme.defaultMode).
        public string PreferredTheme { get; set; }

        // Id пресета из ThemePaletteCatalog; null = дефолт сайта (theme.activePalette).
        public string PreferredPalette { get; set; }

        // ISO-4217 из CurrencyCatalog, регистр не важен (нормализуется в верхний);
        // null = базовая валюта каталога.
        public string PreferredCurrency { get; set; }

        // null = сброс к текущему поведению рассылки (LanguageCode.Russian): отдельной
        // настройки «язык сайта по умолчанию» в SiteSettingCatalog нет, а колонка
        // User.PreferredLanguage не nullable.
        public LanguageCode? PreferredLanguage { get; set; }

        // null = сброс к дефолту (только Email). Пустой набор (None) — не то же самое,
        // что null: он отвергается с NotificationChannelsRequired.
        public NotificationChannelFlags? NotificationChannels { get; set; }
    }
}
