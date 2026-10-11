using ATTours.Common.Settings;
using Microsoft.Extensions.Logging;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace ATTours.BusinessServices.Email
{
    // Реальная отправка через SendGrid v3 Mail Send. Namespace-пакет SendGrid сознательно
    // не подключён: тело запроса — три поля, а лишняя зависимость тянет свою модель ошибок.
    public class SendGridEmailSender : IEmailSender
    {
        private const string MailSendUrl = "https://api.sendgrid.com/v3/mail/send";

        private readonly EmailSettings settings;
        private readonly ILogger<SendGridEmailSender> logger;
        private readonly HttpClient httpClient;

        public SendGridEmailSender(EmailSettings settings, ILogger<SendGridEmailSender> logger, HttpClient httpClient)
        {
            this.settings = settings;
            this.logger = logger;
            this.httpClient = httpClient;
            this.httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", settings.SendGridApiKey);
        }

        public bool ExposesTokenToCaller => false;

        // Однополучательская перегрузка сведена к общей: одна форма payload'а вместо двух,
        // которые пришлось бы синхронно править при любой смене схемы SendGrid.
        public Task SendTransactionalAsync(string toEmail, string toName, string subject, string bodyHtml,
            EmailAttachment? attachment = null, CancellationToken cancellationToken = default)
        {
            var recipients = new EmailRecipients
            {
                To = [new EmailAddress { Email = toEmail, Name = toName }]
            };

            return SendTransactionalAsync(recipients, subject, bodyHtml, attachment, cancellationToken);
        }

        // Письма заказов (Задача E): тема и тело уже отрендерены из шаблона в БД, транспорту
        // остаётся только доставка. content — text/html, а не text/plain: шаблоны HTML.
        public async Task SendTransactionalAsync(EmailRecipients recipients, string subject, string bodyHtml,
            EmailAttachment? attachment = null, CancellationToken cancellationToken = default)
        {
            // Пустой To в транспорт не отдаём: SendGrid отверг бы такой запрос, а резолвер
            // уже гарантирует непустой список (Cc/Bcc-only письмо получает To = FromEmail).
            if (recipients is null || recipients.To.Count == 0)
            {
                logger.LogWarning("SendGrid message «{Subject}» has no To recipients; skipped.", subject);
                return;
            }

            // SendGrid v3: to/cc/bcc живут внутри ОДНОЙ personalization — иначе каждая копия
            // ушла бы отдельным письмом, и получатели не видели бы друг друга.
            var personalization = new Dictionary<string, object>
            {
                ["to"] = ToSendGridArray(recipients.To)
            };

            if (recipients.Cc.Count > 0)
                personalization["cc"] = ToSendGridArray(recipients.Cc);

            if (recipients.Bcc.Count > 0)
                personalization["bcc"] = ToSendGridArray(recipients.Bcc);

            // Словарь, а не анонимный тип: наличие вложения меняет состав полей payload'а,
            // и две разные анонимные формы пришлось бы дублировать целиком.
            var payload = new Dictionary<string, object>
            {
                ["personalizations"] = new[] { personalization },
                ["from"] = new { email = settings.FromEmail, name = settings.FromName },
                ["subject"] = subject,
                ["content"] = new[] { new { type = "text/html", value = bodyHtml } }
            };

            // SendGrid v3 mail/send: ключ "attachments" (мн. число), base64 content.
            if (attachment is not null)
                payload["attachments"] = new[]
                {
                    new
                    {
                        content = Convert.ToBase64String(attachment.Content),
                        filename = attachment.FileName,
                        type = "application/pdf",
                        disposition = "attachment"
                    }
                };

            await PostAsync(payload, recipients.To[0].Email, cancellationToken);
        }

        private static object[] ToSendGridArray(List<EmailAddress> addresses)
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
                    logger.LogError("SendGrid rejected the message to {Email}: {StatusCode} {Details}",
                        toEmail, response.StatusCode, details);
                }
            }
            catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
            {
                logger.LogError(exception, "SendGrid request for {Email} failed.", toEmail);
            }
        }
    }
}
