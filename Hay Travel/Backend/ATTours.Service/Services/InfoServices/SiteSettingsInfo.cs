using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.SiteSettings;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using System.Globalization;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение настроек сайта. Состав ключей задаёт каталог в коде (ADR 002),
    // БД поставляет только сохранённые значения — слияние этих двух источников
    // живёт здесь, а не в репозитории и не в БД.
    public class SiteSettingsInfo : EntityInfoBase<SiteSetting>
    {
        public SiteSettingsInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public SiteSettingsInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public SiteSettingsInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        protected override IEntityQueryableRepository<SiteSetting> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository().Include(x => x.Translations);
        }

        // Полный список настроек: каталог, поверх которого наложены сохранённые значения.
        // Ключ, которого нет в БД, возвращается с Id = 0 и дефолтами каталога.
        // Строка в БД, ключ которой убрали из каталога, наружу не отдаётся (но и не удаляется).
        public async Task<List<SiteSetting>> GetMergedAsync()
        {
            var stored = await GetAllAsync();
            return Merge(stored);
        }

        // Срез каталога для экрана «Настройки сайта»: без групп, которыми владеет другой экран
        // (SiteSettingCatalog.BelongsToSettingsScreen). Отдельный метод, а не параметр
        // GetMergedAsync: полный слитый список нужен и внутри самого класса (GetPublicAsync),
        // и на записи — обрезать его по умолчанию значило бы менять смысл всех вызовов ради
        // одного экрана.
        public async Task<List<SiteSetting>> GetMergedForSettingsScreenAsync()
            => FilterForSettingsScreen(await GetMergedAsync());

        // Тот же фильтр для уже слитого списка — им пользуется ответ Update: экран настроек
        // получает после сохранения ровно тот набор ключей, что и при загрузке, иначе скрытые
        // группы возвращались бы на экран первым же сохранением.
        public static List<SiteSetting> FilterForSettingsScreen(List<SiteSetting> merged)
            => merged.Where(setting => SiteSettingCatalog.BelongsToSettingsScreen(setting.Key)).ToList();

        // Публичное чтение: только IsPublic-ключи, одна локаль, значение уже разрешено.
        // Никогда не отдаёт null для известного ключа и никогда не отвечает 404.
        public async Task<Dictionary<string, string>> GetPublicAsync(int languageCode, SiteSettingGroup? group = null)
        {
            var merged = await GetMergedAsync();
            var values = new Dictionary<string, string>(StringComparer.Ordinal);

            foreach (var setting in merged)
            {
                var definition = SiteSettingCatalog.ByKey(setting.Key);
                if (definition is null || !definition.IsPublic)
                    continue;

                if (group.HasValue && definition.Group != group.Value)
                    continue;

                values[definition.Key] = ResolveValue(setting, definition, languageCode);
            }

            return values;
        }

        // Точечное чтение числовой настройки (SettingValueType.Number) — то, чем пользуются
        // фоновые задачи и валидация заказа: им не нужен весь каталог, нужен один порог.
        //
        // Никогда не бросает и никогда не возвращает «ничего»: испорченное или отсутствующее
        // значение молча заменяется дефолтом каталога. Иначе опечатка в одной настройке
        // роняла бы задачу целиком, а порог автозакрытия обязан существовать всегда.
        // Валидация не даёт положить в БД нечисло (SiteSettingsValidationService), так что
        // фолбэк — страховка от данных, попавших в таблицу мимо API.
        public async Task<int> GetNumberAsync(string key)
        {
            var definition = SiteSettingCatalog.ByKey(key)
                ?? throw new ArgumentException($"Site setting key '{key}' is unknown.", nameof(key));

            var raw = (await GetRawValuesAsync([key])).GetValueOrDefault(key);

            if (TryParseNumber(raw, out var value))
                return value;

            // Дефолт каталога обязан быть числом у Number-ключа — это ошибка разработчика,
            // а не данных, и падать на ней надо громко.
            if (TryParseNumber(definition.DefaultValue, out var fallback))
                return fallback;

            throw new InvalidOperationException(
                $"Site setting '{key}' is declared as Number but its catalog default '{definition.DefaultValue}' is not an integer.");
        }

        // Сырые (неразрешённые по языку) значения набора ключей одним чтением — то, что
        // нужно экрану «Джобы»: параметры задач язык-нейтральны, а весь каталог настроек
        // ради двух порогов тянуть незачем.
        //
        // Правило фолбэка ровно одно на весь класс: сохранённое непустое значение, иначе
        // дефолт каталога. Его же использует GetNumberAsync (и, через него, сами джобы) —
        // второй копии этого правила быть не должно, иначе экран показывал бы одно, а
        // задача читала другое.
        //
        // Неизвестный ключ молча пропускается: состав ключей задаёт каталог, и «ключа нет»
        // здесь означает рассинхрон каталогов, а не запрос пользователя.
        public async Task<Dictionary<string, string>> GetRawValuesAsync(IReadOnlyCollection<string> keys)
        {
            var values = new Dictionary<string, string>(StringComparer.Ordinal);
            if (keys is null || keys.Count == 0)
                return values;

            // Материализуем в List: Contains по нему EF транслирует в IN (...).
            var requestedKeys = keys.Distinct(StringComparer.Ordinal).ToList();

            var stored = await GetAllAsync(setting => requestedKeys.Contains(setting.Key));
            var storedByKey = stored.Where(setting => setting.Key is not null)
                                    .ToDictionary(setting => setting.Key, StringComparer.Ordinal);

            foreach (var key in requestedKeys)
            {
                var definition = SiteSettingCatalog.ByKey(key);
                if (definition is null)
                    continue;

                var raw = storedByKey.TryGetValue(key, out var setting) ? setting.Value : null;

                values[key] = string.IsNullOrWhiteSpace(raw)
                    ? definition.DefaultValue ?? string.Empty
                    : raw;
            }

            return values;
        }

        private static bool TryParseNumber(string? raw, out int value)
        {
            value = 0;
            return !string.IsNullOrWhiteSpace(raw)
                && int.TryParse(raw.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
        }

        // Правило разрешения значения: перевод(язык) ?? Value ?? DefaultValue.
        // Следствие: третий язык не ломает сайт — до заполнения переводов отдаётся
        // язык-нейтральное значение, а не null.
        public static string ResolveValue(SiteSetting setting, SiteSettingDefinition definition, int languageCode)
        {
            string? translated = null;
            if (definition.IsTranslatable && setting.Translations is not null)
            {
                translated = setting.Translations
                                    .FirstOrDefault(translation => (int)translation.LanguageCode == languageCode)
                                    ?.Value;
            }

            return translated ?? setting.Value ?? definition.DefaultValue ?? string.Empty;
        }

        // Слияние «каталог <- БД». Сохранённая строка возвращается как есть (админка
        // должна видеть именно то, что лежит в БД); дефолт каталога подставляется
        // только для ключа, которого в БД ещё нет.
        private static List<SiteSetting> Merge(List<SiteSetting> stored)
        {
            var storedByKey = stored.Where(setting => setting.Key is not null)
                                    .ToDictionary(setting => setting.Key, StringComparer.Ordinal);

            var merged = new List<SiteSetting>(SiteSettingCatalog.All.Count);
            foreach (var definition in SiteSettingCatalog.All.OrderBy(definition => definition.SortOrder))
            {
                merged.Add(storedByKey.TryGetValue(definition.Key, out var setting)
                    ? setting
                    : CreateFromDefinition(definition));
            }

            return merged;
        }

        private static SiteSetting CreateFromDefinition(SiteSettingDefinition definition)
        {
            var setting = new SiteSetting
            {
                Key = definition.Key,
                Value = definition.DefaultValue
            };

            foreach (var defaultTranslation in definition.DefaultTranslations)
            {
                setting.Translations.Add(new SiteSettingTranslation
                {
                    LanguageCode = defaultTranslation.Key,
                    Value = defaultTranslation.Value
                });
            }

            return setting;
        }
    }
}
