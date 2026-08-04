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

        // Сбой провайдера не должен ронять запрос: регистрация/восстановление уже записаны
        // в БД, а повторная отправка достигается повторным вызовом эндпоинта.
        private async Task SendAsync(string toEmail, string toName, string subject, string body, CancellationToken cancellationToken)
        {
            var payload = new
            {
                sender = new { email = settings.FromEmail, name = settings.FromName },
                to = new[] { new { email = toEmail, name = toName } },
                subject,
                textContent = body
            };

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
