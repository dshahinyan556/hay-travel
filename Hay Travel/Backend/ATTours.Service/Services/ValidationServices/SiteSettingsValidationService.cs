using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.SiteSettings;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Globalization;
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
                ValidateNumberValue(entity);
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

        // Number-ключи хранятся строкой, как и все остальные, поэтому «24 часа» или "-"
        // легли бы в БД без единой жалобы, а обнаружилось бы это только в 03:00, когда
        // задача не смогла разобрать значение и тихо ушла на дефолт.
        //
        // Границ (минимум/максимум) здесь намеренно нет: каталог их не объявляет, а
        // выдумывать общий диапазон для «часов», «дней» и будущих лимитов — гарантированно
        // ошибиться. Когда конкретному ключу понадобится диапазон, он появится в его
        // SiteSettingDefinition (там же, где сейчас живут Options для Select), и проверка
        // добавится сюда тем же способом, что ValidateSelectValue — по метаданным ключа,
        // без списка ключей в коде валидатора.
        private static void ValidateNumberValue(SiteSetting entity)
        {
            var definition = SiteSettingCatalog.ByKey(entity.Key);
            if (definition.ValueType != SettingValueType.Number)
                return;

            // Пустое значение допустимо: настройка не заполнена, наружу уйдёт DefaultValue.
            if (string.IsNullOrWhiteSpace(entity.Value))
                return;

            // InvariantCulture и NumberStyles.Integer: значение — часть контракта, а не
            // локализованный ввод, «1 000» и «24,5» должны отбиваться, а не угадываться.
            if (!int.TryParse(entity.Value.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out _))
                throw new ErrorModelException(GlobalErrorCode.SiteSettingValueNotAllowed, HttpStatusCode.BadRequest,
                    $"Site setting '{entity.Key}' expects an integer number, got '{entity.Value}'.");
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
