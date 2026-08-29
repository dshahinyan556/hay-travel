using ATTours.Common.Settings;
using Microsoft.Extensions.Logging;
using System.Net.Http.Json;

namespace ATTours.BusinessServices.Telegram
{
    // Реальная отправка через Telegram Bot API (метод sendMessage). Чистый HttpClient, без
    // NuGet Telegram.Bot: используется ровно один метод API, а входящий webhook разбирает
    // крошечный срез JSON (ADR 031 §1). Паттерн один-в-один с BrevoEmailSender.
    public class TelegramApiSender : ITelegramSender
    {
        private const string ApiBaseUrl = "https://api.telegram.org";

        private readonly TelegramSettings settings;
        private readonly ILogger<TelegramApiSender> logger;
        private readonly HttpClient httpClient;

        public TelegramApiSender(TelegramSettings settings, ILogger<TelegramApiSender> logger, HttpClient httpClient)
        {
            this.settings = settings;
            this.logger = logger;
            this.httpClient = httpClient;
        }

        public bool IsConfigured => true;

        public Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default)
        {
            // Пустое сообщение Bot API отвергает — до сети не идём: это не сбой доставки,
            // а пустой сборщик текста на нашей стороне.
            if (string.IsNullOrWhiteSpace(text))
            {
                logger.LogWarning("Telegram message for chat {ChatId} is empty; skipped.", chatId);
                return Task.CompletedTask;
            }

            var payload = new
            {
                chat_id = chatId,
                text,
                parse_mode = "HTML"
            };

            return PostAsync("sendMessage", payload, chatId, cancellationToken);
        }

        // Сбой провайдера не должен ронять запрос: бронь/назначение уже записаны в БД,
        // а Telegram здесь — дублирующий канал (ADR 031 §3). Токен в URL не логируется.
        private async Task PostAsync<TPayload>(string method, TPayload payload, long chatId,
            CancellationToken cancellationToken)
        {
            var url = $"{ApiBaseUrl}/bot{settings.BotToken}/{method}";

            try
            {
                using var response = await httpClient.PostAsJsonAsync(url, payload, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    var details = await response.Content.ReadAsStringAsync(cancellationToken);
                    logger.LogError("Telegram rejected {Method} for chat {ChatId}: {StatusCode} {Details}",
                        method, chatId, response.StatusCode, details);
                }
            }
            catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
            {
                logger.LogError(exception, "Telegram {Method} request for chat {ChatId} failed.", method, chatId);
            }
        }
    }
}
