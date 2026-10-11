using ATTours.Common.Settings;
using Microsoft.Extensions.Logging;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace ATTours.BusinessServices.Email
{
    // Реальная отправка через Brevo (ex-Sendinblue) Transactional Email API v3.
    public class BrevoEmailSender : IEmailSender
    {
        private const string MailSendUrl = "https://api.brevo.com/v3/smtp/email";

        private readonly EmailSettings settings;
        private readonly ILogger<BrevoEmailSender> logger;
        private readonly HttpClient httpClient;

        public BrevoEmailSender(EmailSettings settings, ILogger<BrevoEmailSender> logger, HttpClient httpClient)
        {
            this.settings = settings;
            this.logger = logger;
            this.httpClient = httpClient;
            this.httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            this.httpClient.DefaultRequestHeaders.Add("api-key", settings.BrevoApiKey);
        }

        public bool ExposesTokenToCaller => false;

        // Однополучательская перегрузка сведена к общей: одна форма payload'а вместо двух,
        // которые пришлось бы синхронно править при любой смене схемы Brevo.
        public Task SendTransactionalAsync(string toEmail, string toName, string subject, string bodyHtml,
            EmailAttachment? attachment = null, CancellationToken cancellationToken = default)
        {
            var recipients = new EmailRecipients
            {
                To = [new EmailAddress { Email = toEmail, Name = toName }]
            };

            return SendTransactionalAsync(recipients, subject, bodyHtml, attachment, cancellationToken);
        }

        // Письма заказов (Задача E): тема и тело уже отрендерены из шаблона, транспорту
        // остаётся только доставка. Тело — htmlContent, а не textContent: шаблоны HTML.
        public async Task SendTransactionalAsync(EmailRecipients recipients, string subject, string bodyHtml,
            EmailAttachment? attachment = null, CancellationToken cancellationToken = default)
        {
            // Пустой To в транспорт не отдаём: Brevo отверг бы такой запрос, а резолвер
            // уже гарантирует непустой список (Cc/Bcc-only письмо получает To = FromEmail).
            if (recipients is null || recipients.To.Count == 0)
            {
                logger.LogWarning("Brevo message «{Subject}» has no To recipients; skipped.", subject);
                return;
            }

            // Словарь, а не анонимный тип: наличие вложения и копий меняет состав полей
            // payload'а, и разные анонимные формы пришлось бы дублировать целиком.
            var payload = new Dictionary<string, object>
            {
                ["sender"] = new { email = settings.FromEmail, name = settings.FromName },
                ["to"] = ToBrevoArray(recipients.To),
                ["subject"] = subject,
                ["htmlContent"] = bodyHtml
            };

            if (recipients.Cc.Count > 0)
                payload["cc"] = ToBrevoArray(recipients.Cc);

            if (recipients.Bcc.Count > 0)
                payload["bcc"] = ToBrevoArray(recipients.Bcc);

            // Brevo v3 smtp/email: ключ "attachment" (ед. число), значение — массив.
            if (attachment is not null)
                payload["attachment"] = new[]
                {
                    new { content = Convert.ToBase64String(attachment.Content), name = attachment.FileName }
                };

            await PostAsync(payload, recipients.To[0].Email, cancellationToken);
        }

        // Brevo требует непустое name у адресата — у свободного адреса подставляем сам адрес.
        private static object[] ToBrevoArray(List<EmailAddress> addresses)
            => [.. addresses.Select(address => new
            {
                email = address.Email,
                name = string.IsNullOrWhiteSpace(address.Name) ? address.Email : address.Name
            })];

        // Сбой провайдера не должен ронять запрос: регистрация/восстановление/назначение уже
        // записаны в БД, а повторная отправка достигается повторным вызовом эндпоинта.
        private async Task PostAsync<TPayload>(TPayload payload, string toEmail, CancellationToken cancellationToken)
        {
            try
            {
                using var response = await httpClient.PostAsJsonAsync(MailSendUrl, payload, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    var details = await response.Content.ReadAsStringAsync(cancellationToken);
                    logger.LogError("Brevo rejected the message to {Email}: {StatusCode} {Details}",
                        toEmail, response.StatusCode, details);
                }
            }
            catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
            {
                logger.LogError(exception, "Brevo request for {Email} failed.", toEmail);
            }
        }
    }
}
