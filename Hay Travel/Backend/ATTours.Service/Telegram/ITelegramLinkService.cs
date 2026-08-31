using ATTours.BusinessServices.Services.AuthServices;
using ATTours.Common.DTO.Account;
using ATTours.Common.DTO.Telegram;

namespace ATTours.BusinessServices.Telegram
{
    // Привязка «пользователь ↔ чат бота» (ADR 031 §4). Одноразовый код живёт в UserToken
    // (UserTokenType.TelegramLink), долгоживущий chat id — в колонках User.
    public interface ITelegramLinkService
    {
        // Профиль: выдать (или перевыпустить) одноразовый код привязки текущего пользователя.
        // Бросает TelegramNotConfigured, если TelegramSettings.IsConfigured == false.
        //
        // requestContext обязателен: код живёт в UserToken, где RequestIp — NOT NULL
        // (UserTokenConfiguration), общий для всех одноразовых токенов аудит-контракт.
        Task<TelegramLinkCodeModel> IssueLinkCodeAsync(int userId, RequestContextModel requestContext,
            CancellationToken cancellationToken = default);

        // Профиль: статус привязки текущего пользователя.
        Task<TelegramLinkStatusModel> GetStatusAsync(int userId, CancellationToken cancellationToken = default);

        // Профиль: отвязать (сбросить TelegramChatId/TelegramUsername).
        Task UnlinkAsync(int userId, CancellationToken cancellationToken = default);

        // Webhook: обработать входящий апдейт. Внутри распознаёт "/start <код>", остальное
        // логирует и игнорирует. Возвращает текст-ответ для отправки пользователю в Telegram
        // (или пустой результат, если отвечать нечего).
        Task<TelegramUpdateResult> HandleUpdateAsync(TelegramUpdateModel update, CancellationToken cancellationToken = default);
    }

    // chatId нужен контроллеру, чтобы отправить ReplyText обратно через ITelegramSender.
    // ChatId == null — отвечать нечего (не наш тип апдейта).
    public sealed class TelegramUpdateResult
    {
        public long? ChatId { get; init; }

        public string? ReplyText { get; init; }
    }
}
