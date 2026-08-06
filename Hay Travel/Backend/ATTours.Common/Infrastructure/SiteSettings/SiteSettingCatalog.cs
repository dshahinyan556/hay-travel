using ATTours.Common.Enums;

namespace ATTours.Common.Infrastructure.SiteSettings
{
    // Единственный источник правды по составу настроек сайта (ADR 002).
    // Добавить настройку = добавить одну строку сюда: ни миграции, ни сида не требуется.
    // Порядок строк = порядок отображения в админке (SortOrder проставлен явно).
    public static class SiteSettingCatalog
    {
        private static readonly IReadOnlyList<SiteSettingDefinition> definitions =
        [
            // ---- Hero ----
            new("hero.imageUrl",       SiteSettingGroup.Hero,     SettingValueType.ImageUrl,      isTranslatable: false, isPublic: true, sortOrder: 0),
            new("hero.title",          SiteSettingGroup.Hero,     SettingValueType.Text,          isTranslatable: true,  isPublic: true, sortOrder: 1),
            new("hero.subtitle",       SiteSettingGroup.Hero,     SettingValueType.MultilineText, isTranslatable: true,  isPublic: true, sortOrder: 2),
            new("hero.ctaLabel",       SiteSettingGroup.Hero,     SettingValueType.Text,          isTranslatable: true,  isPublic: true, sortOrder: 3),
            new("hero.ctaHref",        SiteSettingGroup.Hero,     SettingValueType.Url,           isTranslatable: false, isPublic: true, sortOrder: 4),

            // ---- Branding ----
            // Логотип — ровно один ключ (решение D-4). Пара под светлую/тёмную тему
            // при необходимости добавляется позже одной строкой, без миграции.
            new("branding.logoUrl",    SiteSettingGroup.Branding, SettingValueType.ImageUrl,      isTranslatable: false, isPublic: true, sortOrder: 5),

            // ---- Contacts ----
            // Дефолты — прежние хардкод-значения футера (Footer.tsx до 2026-08-02), чтобы
            // подключение футера к этим ключам не показало пустоту на сайте день в день.
            new("contacts.phone",        SiteSettingGroup.Contacts, SettingValueType.Text,        isTranslatable: false, isPublic: true, sortOrder: 6,
                defaultValue: "+374 10 123 456"),
            new("contacts.email",        SiteSettingGroup.Contacts, SettingValueType.Text,        isTranslatable: false, isPublic: true, sortOrder: 7,
                defaultValue: "info@haytravel.am"),
            new("contacts.address",      SiteSettingGroup.Contacts, SettingValueType.Text,        isTranslatable: true,  isPublic: true, sortOrder: 8,
                defaultValue: "Ереван, ул. Туманяна, 12",
                defaultTranslations: new Dictionary<LanguageCode, string>
                {
                    [LanguageCode.Russian] = "Ереван, ул. Туманяна, 12",
                    [LanguageCode.English] = "12 Tumanyan St, Yerevan",
                }),
            new("contacts.workingHours", SiteSettingGroup.Contacts, SettingValueType.Text,        isTranslatable: true,  isPublic: true, sortOrder: 9),

            // ---- Social ----
            new("social.instagramUrl", SiteSettingGroup.Social,   SettingValueType.Url,           isTranslatable: false, isPublic: true, sortOrder: 10),
            new("social.facebookUrl",  SiteSettingGroup.Social,   SettingValueType.Url,           isTranslatable: false, isPublic: true, sortOrder: 11),
            new("social.telegramUrl",  SiteSettingGroup.Social,   SettingValueType.Url,           isTranslatable: false, isPublic: true, sortOrder: 12),
            new("social.whatsappUrl",  SiteSettingGroup.Social,   SettingValueType.Url,           isTranslatable: false, isPublic: true, sortOrder: 13),
            new("social.youtubeUrl",   SiteSettingGroup.Social,   SettingValueType.Url,           isTranslatable: false, isPublic: true, sortOrder: 14),

            // ---- Seo ----
            new("seo.siteTitle",       SiteSettingGroup.Seo,      SettingValueType.Text,          isTranslatable: true,  isPublic: true, sortOrder: 15),
            new("seo.metaDescription", SiteSettingGroup.Seo,      SettingValueType.MultilineText, isTranslatable: true,  isPublic: true, sortOrder: 16),
            new("seo.ogImageUrl",      SiteSettingGroup.Seo,      SettingValueType.ImageUrl,      isTranslatable: false, isPublic: true, sortOrder: 17),

            // ---- Content ----
            // Раньше хардкод во Frontend/src/shared/i18n/dictionary.ts — дефолты ниже переносят
            // ровно тот же текст, так что подключение фронта к этим ключам ничего не меняет
            // на сайте, пока админ не отредактирует значение.
            new("content.footerTagline",   SiteSettingGroup.Content, SettingValueType.MultilineText, isTranslatable: true, isPublic: true, sortOrder: 18,
                defaultValue: "Туры и экскурсии по Армении — от Севана до Татева. Небольшие группы, местные гиды.",
                defaultTranslations: new Dictionary<LanguageCode, string>
                {
                    [LanguageCode.Russian] = "Туры и экскурсии по Армении — от Севана до Татева. Небольшие группы, местные гиды.",
                    [LanguageCode.English] = "Tours and day trips across Armenia — from Sevan to Tatev. Small groups, local guides.",
                }),
            new("content.catalogTitle",     SiteSettingGroup.Content, SettingValueType.Text,          isTranslatable: true, isPublic: true, sortOrder: 19,
                defaultValue: "Путешествия",
                defaultTranslations: new Dictionary<LanguageCode, string>
                {
                    [LanguageCode.Russian] = "Путешествия",
                    [LanguageCode.English] = "Trips",
                }),
            new("content.catalogSubtitle",  SiteSettingGroup.Content, SettingValueType.MultilineText, isTranslatable: true, isPublic: true, sortOrder: 20,
                defaultValue: "Туры и экскурсии по всем 11 регионам Армении. Экскурсия — один день без ночёвки, тур — два дня и больше.",
                defaultTranslations: new Dictionary<LanguageCode, string>
                {
                    [LanguageCode.Russian] = "Туры и экскурсии по всем 11 регионам Армении. Экскурсия — один день без ночёвки, тур — два дня и больше.",
                    [LanguageCode.English] = "Tours and excursions across all 11 regions of Armenia. An excursion is a single day with no overnight stay; a tour is two days or more.",
                }),
            new("content.featuredHeading",  SiteSettingGroup.Content, SettingValueType.Text,          isTranslatable: true, isPublic: true, sortOrder: 21,
                defaultValue: "Маршруты, которые берут чаще всего",
                defaultTranslations: new Dictionary<LanguageCode, string>
                {
                    [LanguageCode.Russian] = "Маршруты, которые берут чаще всего",
                    [LanguageCode.English] = "Our most popular routes",
                }),

            // ---- Seo (продолжение) ----
            // sortOrder 22 — следующий свободный номер в конце списка (SortOrder глобальный по
            // всему каталогу), не 17.5/переномерация 18-21 (B9, 2026-08-06).
            new("seo.faviconUrl",      SiteSettingGroup.Seo,      SettingValueType.ImageUrl,      isTranslatable: false, isPublic: true, sortOrder: 22),

            // ---- Content (продолжение) ----
            // sortOrder 23 — следующий свободный номер в конце глобальной последовательности
            // (то же правило, что описано у seo.faviconUrl), не 21.5 и не перенумерация.
            // Текст-приглашение для групп 7+: с этого размера группы цена на сайте не
            // показывается, вместо неё выводится это приглашение оставить заявку
            // (ADR 008 / currency-pricing-sync §6, F5.1). Живёт в настройках, а не в i18n
            // фронта, чтобы Давид правил формулировку в админке без редеплоя.
            // Дефолты ниже — рабочая заглушка, финальный текст задаётся в
            // «Настройки -> Тексты сайта».
            new("content.largeGroupInvitation", SiteSettingGroup.Content, SettingValueType.MultilineText, isTranslatable: true, isPublic: true, sortOrder: 23,
                defaultValue: "Для групп от 7 человек мы рассчитываем стоимость индивидуально. Оставьте заявку — мы изучим её и вернёмся к вам с ценой.",
                defaultTranslations: new Dictionary<LanguageCode, string>
                {
                    [LanguageCode.Russian] = "Для групп от 7 человек мы рассчитываем стоимость индивидуально. Оставьте заявку — мы изучим её и вернёмся к вам с ценой.",
                    [LanguageCode.English] = "For groups of 7 or more we quote the price individually. Send us a request — we will review it and get back to you with a price.",
                }),
        ];

        // Ключи сравниваются точно (Ordinal): ключ — часть контракта API,
        // а не пользовательский ввод.
        private static readonly IReadOnlyDictionary<string, SiteSettingDefinition> definitionsByKey =
            definitions.ToDictionary(definition => definition.Key, StringComparer.Ordinal);

        public static IReadOnlyList<SiteSettingDefinition> All => definitions;

        // null, если ключ неизвестен.
        public static SiteSettingDefinition ByKey(string key)
            => key is not null && definitionsByKey.TryGetValue(key, out var definition) ? definition : null;

        public static bool IsKnown(string key) => key is not null && definitionsByKey.ContainsKey(key);
    }
}
