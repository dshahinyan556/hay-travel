using Microsoft.Extensions.Configuration;

namespace ATTours.Common.Settings
{
    // Секция "Telegram" конфигурации (ADR 031). Полный аналог EmailSettings: IsConfigured
    // выбирает реализацию ITelegramSender в DI — TelegramApiSender при настроенном боте,
    // иначе DevTelegramSender (сообщение только логируется).
    public class TelegramSettings : ApplicationSettingsBase<TelegramSettings>
    {
        private const string SectionName = "Telegram";

        private IConfigurationSection Section => Configuration.GetSection(SectionName);

        public string BotToken => Section[nameof(BotToken)];

        public string BotUsername => Section[nameof(BotUsername)] ?? "HayTravelNotificationsBot";

        // Значение заголовка X-Telegram-Bot-Api-Secret-Token, задаётся при setWebhook.
        public string WebhookSecret => Section[nameof(WebhookSecret)];

        public int LinkCodeLifetimeMinutes =>
            int.TryParse(Section[nameof(LinkCodeLifetimeMinutes)], out var minutes) ? minutes : 30;

        // Бот считается настроенным только когда заданы И токен, И webhook-secret — иначе
        // тихо работал бы Dev-режим (лог вместо отправки), а webhook отвергал бы всё.
        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(BotToken) && !string.IsNullOrWhiteSpace(WebhookSecret);

        // База deep-link, к которой сервис привязки клеит "?start=<код>".
        public string DeepLinkBase => $"https://t.me/{BotUsername}";
    }
}
