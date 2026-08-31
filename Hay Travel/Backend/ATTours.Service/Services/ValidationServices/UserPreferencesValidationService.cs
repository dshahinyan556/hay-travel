using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Currencies;
using ATTours.Common.Infrastructure.SiteSettings;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Правила личных предпочтений (2026-08-29). Наследуется от EntityValidationBase, а не от
    // Context-зависимого варианта: все четыре проверки читают только саму строку User
    // (включая TelegramChatId), в БД ходить не за чем.
    //
    // Валидация видит УЖЕ нормализованное состояние: UserPreferencesUpdateService
    // раскладывает модель по полям сущности и только потом зовёт этот класс — так проверка
    // одинаково работала бы и на админском пути, если он когда-нибудь появится.
    //
    // Списки допустимых значений НЕ дублируются здесь: тема — из ключа настроек
    // theme.defaultMode, палитра — из ThemePaletteCatalog, валюта — из CurrencyCatalog.
    // Второй копии любого из трёх списков в проекте быть не должно.
    internal class UserPreferencesValidationService : EntityValidationBase<User>
    {
        public UserPreferencesValidationService(List<User> entities) : base(entities)
        {
        }

        public override Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                ValidateTheme(entity);
                ValidatePalette(entity);
                ValidateCurrency(entity);
                ValidateNotificationChannels(entity);
            }

            return Task.CompletedTask;
        }

        // null пропускается везде ниже: это «личного выбора нет», легитимное состояние.
        private static void ValidateTheme(User entity)
        {
            if (entity.PreferredTheme is null)
                return;

            // Источник правды — options ключа theme.defaultMode: заводить здесь второй
            // список {dark, light} значит гарантированно разойтись с админкой, если
            // появится третий режим.
            var definition = SiteSettingCatalog.ByKey(SiteSettingKeys.ThemeDefaultMode);
            var isKnown = definition?.Options?.Any(option => string.Equals(option.Value, entity.PreferredTheme, StringComparison.Ordinal)) == true;

            if (!isKnown)
                throw new ErrorModelException(GlobalErrorCode.InvalidPreferenceValue, HttpStatusCode.BadRequest,
                    $"Preferred theme '{entity.PreferredTheme}' is not a supported theme mode.");
        }

        private static void ValidatePalette(User entity)
        {
            if (entity.PreferredPalette is null)
                return;

            if (!ThemePaletteCatalog.IsKnown(entity.PreferredPalette))
                throw new ErrorModelException(GlobalErrorCode.InvalidPreferenceValue, HttpStatusCode.BadRequest,
                    $"Preferred palette '{entity.PreferredPalette}' is not a known palette preset.");
        }

        private static void ValidateCurrency(User entity)
        {
            if (entity.PreferredCurrency is null)
                return;

            // ByCode, а не IsFetched: базовая AMD курса в БД не имеет, но переключателем
            // валют выбирается наравне с остальными.
            if (CurrencyCatalog.ByCode(entity.PreferredCurrency) is null)
                throw new ErrorModelException(GlobalErrorCode.InvalidPreferenceValue, HttpStatusCode.BadRequest,
                    $"Preferred currency '{entity.PreferredCurrency}' is not a supported currency code.");
        }

        private static void ValidateNotificationChannels(User entity)
        {
            if (entity.NotificationChannels == NotificationChannelFlags.None)
                throw new ErrorModelException(GlobalErrorCode.NotificationChannelsRequired, HttpStatusCode.BadRequest,
                    "At least one notification channel must be enabled.");

            // Биты, которых нет в enum'е (например 4), — тот же класс ошибки, что неизвестный
            // пресет: значение вне контракта. Без этой проверки они молча легли бы в колонку.
            const NotificationChannelFlags knownChannels = NotificationChannelFlags.Email | NotificationChannelFlags.Telegram;
            if ((entity.NotificationChannels & ~knownChannels) != NotificationChannelFlags.None)
                throw new ErrorModelException(GlobalErrorCode.InvalidPreferenceValue, HttpStatusCode.BadRequest,
                    $"Notification channels value {(int)entity.NotificationChannels} contains unknown channels.");

            // Включить Telegram можно только с привязанным чатом. Отказ, а не тихое снятие
            // бита: иначе в профиле осталась бы включённая галочка, которая ничего не делает.
            //
            // Известный пробел: сама ОТВЯЗКА (DELETE api/Account/Telegram) бит не снимает —
            // TelegramLinkService в этой задаче не трогался. Состояние «бит есть, чата нет»
            // достижимо только этим путём, чинится следующим PUT (он его и отвергнет), а
            // доставка на него не опирается: она всегда идёт по TelegramChatId. Снимать бит
            // при отвязке — задача той же итерации, что и доставка по каналам.
            if (entity.NotificationChannels.HasFlag(NotificationChannelFlags.Telegram) && entity.TelegramChatId is null)
                throw new ErrorModelException(GlobalErrorCode.TelegramChannelNotLinked, HttpStatusCode.BadRequest,
                    "Telegram notifications require a linked Telegram account.");
        }
    }
}
