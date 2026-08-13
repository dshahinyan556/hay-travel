using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.SiteSettings;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация пакета настроек перед upsert.
    // Состав ключей задаёт каталог в коде, поэтому админка не может завести
    // произвольный ключ: неизвестный Key -> 400 SiteSettingKeyUnknown.
    internal class SiteSettingsValidationService : EntityValidationBase<SiteSetting>
    {
        public SiteSettingsValidationService(List<SiteSetting> entities) : base(entities)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            var seenKeys = new HashSet<string>(StringComparer.Ordinal);

            foreach (var entity in Entities)
            {
                if (string.IsNullOrWhiteSpace(entity.Key) || !SiteSettingCatalog.IsKnown(entity.Key))
                    throw new ErrorModelException(GlobalErrorCode.SiteSettingKeyUnknown, HttpStatusCode.BadRequest,
                        $"Site setting key '{entity.Key}' is unknown.");

                // Один ключ дважды в одном запросе — неоднозначность: какое значение победит.
                if (!seenKeys.Add(entity.Key))
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                        $"Site setting key '{entity.Key}' is duplicated in the request!");

                ValidateSelectValue(entity);
                ValidateTranslations(entity);
            }

            await Task.CompletedTask;
        }

        // Для Select-ключей значение обязано быть одним из id, объявленных каталогом:
        // произвольный id палитры/режима не имеет соответствующего CSS на сайте и должен
        // отбиваться как ошибка ввода, а не сохраняться молча (ADR 013).
        // Список опций не дублируется здесь — берётся из definition.Options.
        private static void ValidateSelectValue(SiteSetting entity)
        {
            // Ключ уже проверен на известность выше, definition не null.
            var definition = SiteSettingCatalog.ByKey(entity.Key);
            if (definition.ValueType != SettingValueType.Select)
                return;

            // Пустое значение допустимо: настройка ещё не выбрана, наружу уйдёт DefaultValue.
            if (string.IsNullOrWhiteSpace(entity.Value))
                return;

            var isAllowed = definition.Options
                .Any(option => string.Equals(option.Value, entity.Value, StringComparison.Ordinal));

            if (!isAllowed)
                throw new ErrorModelException(GlobalErrorCode.SiteSettingValueNotAllowed, HttpStatusCode.BadRequest,
                    $"Site setting '{entity.Key}' has value '{entity.Value}' that is not an allowed option.");
        }

        // У настройки не больше одной строки перевода на язык — переводы сверяются
        // по LanguageCode, поэтому дубликат языка сделал бы upsert неоднозначным.
        private static void ValidateTranslations(SiteSetting entity)
        {
            if (entity.Translations is null)
                return;

            var seenLanguages = new HashSet<int>();
            foreach (var translation in entity.Translations)
            {
                if (!seenLanguages.Add((int)translation.LanguageCode))
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                        $"Site setting '{entity.Key}' has duplicated translations for language {(int)translation.LanguageCode}!");
            }
        }
    }
}
