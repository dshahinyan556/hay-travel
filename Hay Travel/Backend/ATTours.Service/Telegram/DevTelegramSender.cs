using Microsoft.Extensions.Logging;

namespace ATTours.BusinessServices.Telegram
{
    // Локальная разработка без настроенного бота: сообщение никуда не уходит, текст
    // печатается в лог — иначе сборку Telegram-уведомления нечем проверить, не заводя
    // реального бота. Калька DevEmailSender.
    public class DevTelegramSender : ITelegramSender
    {
        private readonly ILogger<DevTelegramSender> logger;

        public DevTelegramSender(ILogger<DevTelegramSender> logger)
        {
            this.logger = logger;
        }

        public bool IsConfigured => false;

        public Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default)
        {
            logger.LogInformation("[DevTelegramSender] chat {ChatId}: {Text}", chatId, text);
            return Task.CompletedTask;
        }
    }
}
