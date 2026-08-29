using ATTours.Common.Constants;
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

            // ---- Theme ----
            // sortOrder 24-25 — следующие свободные номера в конце глобальной последовательности
            // (то же правило, что описано у seo.faviconUrl). Оба ключа язык-нейтральны:
            // id пресета и режим не зависят от языка (ADR 013). Список допустимых пресетов —
            // ThemePaletteCatalog, чтобы фронт не хардкодил его, как не хардкодит список ключей.
            new("theme.activePalette", SiteSettingGroup.Theme, SettingValueType.Select,          isTranslatable: false, isPublic: true, sortOrder: 24,
                defaultValue: "obsidian",
                options: ThemePaletteCatalog.Options),

            // Мягкий дефолт режима для новых посетителей: клиентский переключатель темы
            // остаётся рабочим, это только seed-значение.
            new("theme.defaultMode",   SiteSettingGroup.Theme, SettingValueType.Select,          isTranslatable: false, isPublic: true, sortOrder: 25,
                defaultValue: "dark",
                options:
                [
                    new SiteSettingOption("dark",  "Тёмная"),
                    new SiteSettingOption("light", "Светлая"),
                ]),

            // ---- Branding (продолжение) ----
            // sortOrder 26 — следующий свободный номер (Spec 005, дополнение к Spec 002).
            // Фото левой колонки экрана входа: брендовый ассет того же класса, что логотип,
            // поэтому группа Branding, а не новая. Пустое значение — нормальное состояние,
            // фронт подставляет заглушку.
            new("branding.authImageUrl", SiteSettingGroup.Branding, SettingValueType.ImageUrl,   isTranslatable: false, isPublic: true, sortOrder: 26,
                defaultValue: ""),

            // ---- Theme (продолжение) ----
            // sortOrder 27 — следующий свободный номер в конце глобальной последовательности
            // (то же правило, что у seo.faviconUrl). Стиль навигации сайта: текущее плавающее
            // меню-пилюля против сплошной панели со скролл-блюром ("Frosted Rail"). Ключ живёт в
            // Theme, а не в новой группе Layout: это тот же класс решения, что theme.activePalette —
            // кураторский визуальный вариант, который админ только выбирает, а реальная реализация
            // (компоненты/CSS) живёт во фронте (ADR 013). Дефолт "pill" сохраняет текущий вид сайта,
            // пока Давид не переключит в админке. Список опций — часть контракта с фронтом.
            new("theme.navStyle", SiteSettingGroup.Theme, SettingValueType.Select, isTranslatable: false, isPublic: true, sortOrder: 27,
                defaultValue: "pill",
                options:
                [
                    new SiteSettingOption("pill", "Плавающая капсула"),
                    new SiteSettingOption("rail", "Стеклянная лента"),
                ]),

            // ---- Booking ----
            // sortOrder 28-31 — следующие свободные номера в конце глобальной
            // последовательности (то же правило, что у seo.faviconUrl).
            //
            // За сколько часов до начала дня (по времени Армении) день перестаёт продаваться.
            // Читают трое: фоновое автозакрытие (материализует ClosureRule для админ-календаря),
            // валидация заказа (силовой чек, если джоба ещё не тикнула) и публичный
            // GetClosedDates (чтобы дата-пикер гасил дату сразу). Отдельного
            // booking.minLeadTimeHours нет намеренно: смысл тот же, два ключа с одним смыслом
            // гарантированно разъехались бы.
            //
            // isPublic: false у всех четырёх — это операционные настройки, а не контент.
            // Публичный сайт получает не сам порог, а его следствие (список закрытых дат).
            //
            // Ключи этих четырёх строк заданы константами, а не литералами (в отличие от
            // контентных ключей выше): их читает код из нескольких мест, и разъехавшийся
            // литерал означал бы молча взятый дефолт вместо настроенного порога.
            new(SiteSettingKeys.BookingAutoCloseLeadTimeHours, SiteSettingGroup.Booking, SettingValueType.Number, isTranslatable: false, isPublic: false, sortOrder: 28,
                defaultValue: "24"),

            // ---- Jobs ----
            // Сколько часов у неподтверждённого заказа есть до автоотмены, отсчёт от
            // МИНИМАЛЬНОЙ даты тура в заказе. Инвариант: должно быть меньше
            // booking.autoCloseLeadTimeHours, иначе бронь, созданная в последний разрешённый
            // час, отменялась бы сразу; нарушение задача обязана отражать в истории
            // прогонов (Skipped с причиной), а не работать молча.
            new(SiteSettingKeys.OrderAutoCancelDeadlineHours, SiteSettingGroup.Jobs, SettingValueType.Number, isTranslatable: false, isPublic: false, sortOrder: 29,
                defaultValue: "12"),

            // Глубина хранения журнала входов (LoginHistory).
            new(SiteSettingKeys.LoginHistoryRetentionDays, SiteSettingGroup.Jobs, SettingValueType.Number, isTranslatable: false, isPublic: false, sortOrder: 30,
                defaultValue: "90"),

            // Глубина хранения истории прогонов самих задач (ScheduledJobRun).
            new(SiteSettingKeys.RunHistoryRetentionDays, SiteSettingGroup.Jobs, SettingValueType.Number, isTranslatable: false, isPublic: false, sortOrder: 31,
                defaultValue: "90"),
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
