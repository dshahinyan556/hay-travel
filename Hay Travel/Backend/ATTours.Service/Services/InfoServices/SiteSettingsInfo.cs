using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.SiteSettings;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;

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
