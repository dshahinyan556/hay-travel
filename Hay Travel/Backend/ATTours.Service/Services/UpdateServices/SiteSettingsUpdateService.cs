using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Пакетное сохранение настроек сайта.
    // Идентичность записи — Key, а не Id: у ключа, которого ещё нет в БД, Id = 0,
    // и админка не отслеживает id несохранённых ключей.
    // Переводы внутри настройки сверяются по LanguageCode (не больше одной строки
    // на язык) — осознанное отличие от reconcile-по-Id в графе тура.
    public class SiteSettingsUpdateService : EntityActionServiceBase<SiteSetting, ATToursContextFactory>
    {
        public SiteSettingsUpdateService(List<SiteSetting> entities, CancellationToken cancellationToken = default)
            : base(entities, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
        }

        public SiteSettingsUpdateService(List<SiteSetting> entities, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entities, context, cancellationToken)
        {
        }

        // Возвращает полный слитый список (каталог + сохранённые значения),
        // чтобы админке не требовался повторный GetAll после сохранения.
        public async Task<List<SiteSetting>> UpsertAsync()
        {
            await ExecuteEntityChangesAsync();

            // Info работает на том же контексте; сознательно не оборачиваем в using —
            // владелец контекста здесь, и его Dispose закрыл бы соединение раньше времени.
            var info = new SiteSettingsInfo(Context, CancellationToken);
            return await info.GetMergedAsync();
        }

        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            await new SiteSettingsValidationService(Entities).ValidateEntitiesAsync();

            var incomingKeys = Entities.Select(setting => setting.Key).ToList();

            // Tracked-загрузка (без AsNoTracking): изменения значений и переводов
            // должны попасть в SaveChanges.
            var existingSettings = await EntityRepository.AsQueryable()
                                                         .Include(x => x.Translations)
                                                         .Where(x => incomingKeys.Contains(x.Key))
                                                         .ToListAsync(CancellationToken);

            var existingByKey = existingSettings.ToDictionary(setting => setting.Key, StringComparer.Ordinal);

            foreach (var incoming in Entities)
            {
                if (!existingByKey.TryGetValue(incoming.Key, out var target))
                {
                    target = new SiteSetting { Key = incoming.Key };
                    await EntityRepository.AddAsync(target, CancellationToken);
                    existingByKey[incoming.Key] = target;
                }

                target.Value = incoming.Value;
                ReconcileTranslations(target, incoming);
            }
        }

        // Сверка переводов по LanguageCode: язык есть во входящих — обновляем/добавляем,
        // языка нет — строка перевода удаляется каскадом от настройки.
        private static void ReconcileTranslations(SiteSetting target, SiteSetting incoming)
        {
            var incomingTranslations = incoming.Translations ?? [];

            foreach (var incomingTranslation in incomingTranslations)
            {
                var existingTranslation = target.Translations
                                                .FirstOrDefault(translation => translation.LanguageCode == incomingTranslation.LanguageCode);

                if (existingTranslation is null)
                {
                    target.Translations.Add(new SiteSettingTranslation
                    {
                        LanguageCode = incomingTranslation.LanguageCode,
                        Value = incomingTranslation.Value
                    });
                    continue;
                }

                existingTranslation.Value = incomingTranslation.Value;
            }

            var staleTranslations = target.Translations
                                          .Where(translation => incomingTranslations.All(incomingTranslation => incomingTranslation.LanguageCode != translation.LanguageCode))
                                          .ToList();

            foreach (var staleTranslation in staleTranslations)
                target.Translations.Remove(staleTranslation);
        }
    }
}
