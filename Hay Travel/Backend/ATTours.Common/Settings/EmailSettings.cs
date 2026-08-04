using Microsoft.Extensions.Configuration;

namespace ATTours.Common.Settings
{
    // Секция "Email" конфигурации. Provider выбирает реализацию IEmailSender в DI (ADR 005):
    // "SendGrid" при заданном ключе, иначе "Dev" (письмо только логируется).
    public class EmailSettings : ApplicationSettingsBase<EmailSettings>
    {
        private const string SectionName = "Email";

        private IConfigurationSection Section => Configuration.GetSection(SectionName);

        public string Provider => Section[nameof(Provider)] ?? "Dev";

        public string SendGridApiKey => Section[nameof(SendGridApiKey)];

        public string FromEmail => Section[nameof(FromEmail)] ?? "no-reply@haytravel.local";

        public string FromName => Section[nameof(FromName)] ?? "Hay Travel";

        // База ссылки во фронте, к которой сервис клеит "?token=".
        public string VerifyUrlBase => Section[nameof(VerifyUrlBase)] ?? "http://localhost:5173/verify-email";

        public string ResetUrlBase => Section[nameof(ResetUrlBase)] ?? "http://localhost:5173/reset-password";

        // SendGrid включается только когда он явно выбран И ключ реально задан —
        // иначе тихо падали бы все письма.
        public bool IsSendGridConfigured =>
            string.Equals(Provider, "SendGrid", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(SendGridApiKey);
    }
}
