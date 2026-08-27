using Microsoft.Extensions.Configuration;

namespace ATTours.Common.Settings
{
    // Секция "Email" конфигурации. Provider выбирает реализацию IEmailSender в DI (ADR 005):
    // "SendGrid"/"Brevo" при заданном соответствующем ключе, иначе "Dev" (письмо только логируется).
    public class EmailSettings : ApplicationSettingsBase<EmailSettings>
    {
        private const string SectionName = "Email";

        private IConfigurationSection Section => Configuration.GetSection(SectionName);

        public string Provider => Section[nameof(Provider)] ?? "Dev";

        public string SendGridApiKey => Section[nameof(SendGridApiKey)];

        public string BrevoApiKey => Section[nameof(BrevoApiKey)];

        public string FromEmail => Section[nameof(FromEmail)] ?? "no-reply@haytravel.local";

        public string FromName => Section[nameof(FromName)] ?? "Hay Travel";

        // База ссылки во фронте, к которой сервис клеит "?token=".
        public string VerifyUrlBase => Section[nameof(VerifyUrlBase)] ?? "http://localhost:5173/verify-email";

        public string ResetUrlBase => Section[nameof(ResetUrlBase)] ?? "http://localhost:5173/reset-password";

        // Email-change flow (B8, 2026-08-06) — ссылка шага 4, ведёт на страницу подтверждения
        // нового адреса (фронту ещё предстоит завести этот роут).
        public string EmailChangeConfirmUrlBase => Section[nameof(EmailChangeConfirmUrlBase)] ?? "http://localhost:5173/confirm-email-change";

        // Origin (scheme + host + port), с которого почтовый клиент заберёт /uploads/... .
        // Хвостового слэша нет. Пусто -> абсолютизация не выполняется (см. OrderNotificationService):
        // относительный src (картинка не видна) честнее, чем абсолютный src на чужой домен.
        //
        // Фолбэк на origin из VerifyUrlBase — потому что по смыслу это всегда публичный сайт.
        // Логирования здесь нет сознательно: ApplicationSettingsBase логгера не имеет,
        // предупреждение пишет потребитель.
        public string PublicMediaBaseUrl
        {
            get
            {
                var configured = Section[nameof(PublicMediaBaseUrl)];
                if (!string.IsNullOrWhiteSpace(configured))
                    return configured.TrimEnd('/');

                return Uri.TryCreate(VerifyUrlBase, UriKind.Absolute, out var verifyUri)
                    ? verifyUri.GetLeftPart(UriPartial.Authority)
                    : string.Empty;
            }
        }

        // Флоу заказов (B12, 2026-08-13): куда падает уведомление о новой брони. Без
        // отдельно заданного адреса уходит на FromEmail — тот же ящик, с которого сейчас
        // шлётся вся остальная почта сайта.
        public string AdminNotificationEmail => Section[nameof(AdminNotificationEmail)] ?? FromEmail;

        // SendGrid включается только когда он явно выбран И ключ реально задан —
        // иначе тихо падали бы все письма.
        public bool IsSendGridConfigured =>
            string.Equals(Provider, "SendGrid", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(SendGridApiKey);

        public bool IsBrevoConfigured =>
            string.Equals(Provider, "Brevo", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(BrevoApiKey);
    }
}
