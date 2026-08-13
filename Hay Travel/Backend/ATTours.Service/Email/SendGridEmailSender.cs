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

        public Task SendEmailVerificationAsync(string toEmail, string toName, string token, CancellationToken cancellationToken = default)
            => SendAsync(toEmail, toName,
                         EmailMessageFactory.VerifySubject,
                         EmailMessageFactory.BuildVerifyBody(toName, EmailMessageFactory.BuildVerifyUrl(settings, token)),
                         cancellationToken);

        public Task SendPasswordResetAsync(string toEmail, string toName, string token, CancellationToken cancellationToken = default)
            => SendAsync(toEmail, toName,
                         EmailMessageFactory.ResetSubject,
                         EmailMessageFactory.BuildResetBody(toName, EmailMessageFactory.BuildResetUrl(settings, token)),
                         cancellationToken);

        public Task SendEmailChangeOldEmailCodeAsync(string toEmail, string toName, string code, CancellationToken cancellationToken = default)
            => SendAsync(toEmail, toName,
                         EmailMessageFactory.EmailChangeCodeSubject,
                         EmailMessageFactory.BuildEmailChangeCodeBody(toName, code),
                         cancellationToken);

        public Task SendEmailChangeConfirmationAsync(string toEmail, string toName, string token, CancellationToken cancellationToken = default)
            => SendAsync(toEmail, toName,
                         EmailMessageFactory.EmailChangeConfirmSubject,
                         EmailMessageFactory.BuildEmailChangeConfirmBody(toName, EmailMessageFactory.BuildEmailChangeConfirmUrl(settings, token)),
                         cancellationToken);

        public Task SendNewOrderNotificationAsync(string tourTitle, DateOnly tourDate, int guestCount,
            string customerName, string customerEmail, CancellationToken cancellationToken = default)
            => SendAsync(settings.AdminNotificationEmail, settings.FromName,
                         EmailMessageFactory.NewOrderNotificationSubject,
                         EmailMessageFactory.BuildNewOrderNotificationBody(tourTitle, tourDate, guestCount, customerName, customerEmail),
                         cancellationToken);

        // Сбой провайдера не должен ронять запрос: регистрация/восстановление уже записаны
        // в БД, а повторная отправка достигается повторным вызовом эндпоинта.
        private async Task SendAsync(string toEmail, string toName, string subject, string body, CancellationToken cancellationToken)
        {
            var payload = new
            {
                personalizations = new[]
                {
                    new { to = new[] { new { email = toEmail, name = toName } } }
                },
                from = new { email = settings.FromEmail, name = settings.FromName },
                subject,
                content = new[] { new { type = "text/plain", value = body } }
            };

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
