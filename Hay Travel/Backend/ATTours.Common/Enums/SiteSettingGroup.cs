namespace ATTours.Common.Enums
{
    // Группа настроек в админке. Инвариант: Key начинается с имени группы
    // в нижнем регистре + точка (hero.title, contacts.phone, ...).
    public enum SiteSettingGroup
    {
        Hero = 1,
        Contacts = 2,
        Social = 3,
        Branding = 4,
        Seo = 5,
        // Текстовые блоки публичного сайта вне Hero (шапка каталога, футер, секция «избранное»
        // на главной) — раньше жили хардкодом во фронте (Frontend/src/shared/i18n/dictionary.ts).
        Content = 6,
        // Тема оформления сайта: активный пресет палитры + дефолтный режим dark/light.
        // Отдельно от Branding (там только логотип и брендовые ассеты) — ADR 013.
        Theme = 7,
    }
}
