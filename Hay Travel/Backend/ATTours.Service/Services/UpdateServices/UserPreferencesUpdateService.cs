using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.DTO.Account;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Перезапись личных предпочтений пользователя (2026-08-29). Точечный сервис по образцу
    // UserPhoneUpdateService: грузит одну строку по id из токена, поэтому чужую этим
    // сервисом не достать и ролевые guard-проверки здесь не нужны.
    //
    // Операция — ПОЛНАЯ перезапись всех пяти значений (см. UpdatePreferencesModel):
    // null в поле означает «сбросить к дефолту сайта», а не «оставить как было». Именно
    // поэтому здесь нет ни одной проверки вида `if (model.X is not null)` — она превратила
    // бы сброс темы к дефолту в невыразимую операцию.
    public class UserPreferencesUpdateService : RepositoryCoreBase<User, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public UserPreferencesUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task<User> UpdateAsync(UpdatePreferencesModel model, int userId)
        {
            // !IsDeleted: удалённый пользователь отвечает 404, как и несуществующий —
            // тот же предикат, что у UserPhoneUpdateService и UserInfo.
            var user = await EntityRepository.AsQueryable()
                                             .SingleOrDefaultAsync(x => x.Id == userId && !x.IsDeleted, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"User with id {userId} not found.");

            user.PreferredTheme = NormalizeToken(model.PreferredTheme);
            user.PreferredPalette = NormalizeToken(model.PreferredPalette);
            user.PreferredCurrency = NormalizeCurrency(model.PreferredCurrency);

            // Дефолты «сброса» для двух не-nullable колонок. Language: отдельной настройки
            // «язык сайта по умолчанию» в SiteSettingCatalog нет, дефолт задаёт сама сущность
            // (Russian). Channels: только Email — то же значение, что бэкфиллит миграция.
            user.PreferredLanguage = model.PreferredLanguage ?? LanguageCode.Russian;
            user.NotificationChannels = model.NotificationChannels ?? NotificationChannelFlags.Email;

            // Валидация ПОСЛЕ раскладки по полям: правило про Telegram-канал читает
            // TelegramChatId, который есть только у сущности, а не у модели.
            // Вызывается напрямую — у точечного сервиса на RepositoryCoreBase нет конвейера
            // CreateVerifiableEntityBase (тот же приём, что в UserContactMethodUpdateService).
            // Исключение до SaveChangesAsync не сохраняет ничего: сервис одноразовый и
            // диспозится вместе с контекстом.
            await new UserPreferencesValidationService([user]).ValidateEntitiesAsync();

            await EntityRepository.SaveChangesAsync(cancellationToken);

            return user;
        }

        // "" -> null: тот же приём, что в UserPhoneUpdateService — не даёт в БД жить двум
        // представлениям одного состояния «личного выбора нет».
        // Регистр НЕ трогается: id темы и пресета палитры сравниваются с каталогами
        // Ordinal, то есть "Dark" — такое же неверное значение, как "darkk".
        private static string? NormalizeToken(string? value)
        {
            var trimmedValue = value?.Trim();
            return string.IsNullOrWhiteSpace(trimmedValue) ? null : trimmedValue;
        }

        // Валюта, наоборот, приводится к верхнему регистру: ISO-код регистр-независим по
        // смыслу, и "usd" от фронта — не ошибка ввода, а вопрос представления.
        private static string? NormalizeCurrency(string? value)
        {
            var normalizedCurrency = NormalizeToken(value);
            return normalizedCurrency?.ToUpperInvariant();
        }
    }
}
