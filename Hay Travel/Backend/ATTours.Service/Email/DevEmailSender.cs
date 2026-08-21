using ATTours.Common.Settings;
using Microsoft.Extensions.Logging;

namespace ATTours.BusinessServices.Email
{
    // Локальная разработка без почтового провайдера: письмо не уходит никуда, ссылка
    // печатается в лог, а токен дополнительно возвращается в ответе API
    // (ExposesTokenToCaller == true), иначе сценарий verify/reset нечем пройти.
    public class DevEmailSender : IEmailSender
    {
        private readonly EmailSettings settings;
        private readonly ILogger<DevEmailSender> logger;

        public DevEmailSender(EmailSettings settings, ILogger<DevEmailSender> logger)
        {
            this.settings = settings;
            this.logger = logger;
        }

        public bool ExposesTokenToCaller => true;

        public Task SendEmailVerificationAsync(string toEmail, string toName, string token, CancellationToken cancellationToken = default)
        {
            logger.LogInformation("[DevEmailSender] Verify email for {Email}: {Url}",
                toEmail, EmailMessageFactory.BuildVerifyUrl(settings, token));
            return Task.CompletedTask;
        }

        public Task SendPasswordResetAsync(string toEmail, string toName, string token, CancellationToken cancellationToken = default)
        {
            logger.LogInformation("[DevEmailSender] Password reset for {Email}: {Url}",
                toEmail, EmailMessageFactory.BuildResetUrl(settings, token));
            return Task.CompletedTask;
        }

        public Task SendEmailChangeOldEmailCodeAsync(string toEmail, string toName, string code, CancellationToken cancellationToken = default)
        {
            logger.LogInformation("[DevEmailSender] Email change code for {Email}: {Code}", toEmail, code);
            return Task.CompletedTask;
        }

        public Task SendEmailChangeConfirmationAsync(string toEmail, string toName, string token, CancellationToken cancellationToken = default)
        {
            logger.LogInformation("[DevEmailSender] Email change confirmation for {Email}: {Url}",
                toEmail, EmailMessageFactory.BuildEmailChangeConfirmUrl(settings, token));
            return Task.CompletedTask;
        }

        public Task SendNewOrderNotificationAsync(string tourTitle, DateOnly tourDate, int guestCount,
            string customerName, string customerEmail, CancellationToken cancellationToken = default)
        {
            logger.LogInformation("[DevEmailSender] New order notification for {AdminEmail}: {Tour} on {Date}, {Guests} guests, from {Customer} ({CustomerEmail})",
                settings.AdminNotificationEmail, tourTitle, tourDate, guestCount, customerName, customerEmail);
            return Task.CompletedTask;
        }

        public Task SendOrderDocumentAsync(string toEmail, string toName, string orderNumber, byte[] pdfDocument,
            CancellationToken cancellationToken = default)
        {
            logger.LogInformation("[DevEmailSender] Order document for {Email}: order {OrderNumber}, {Bytes} bytes",
                toEmail, orderNumber, pdfDocument.Length);
            return Task.CompletedTask;
        }

        public Task SendAssignmentAsync(string toEmail, string toName, string orderNumber, string assignmentDetails,
            byte[] pdfDocument, CancellationToken cancellationToken = default)
        {
            logger.LogInformation("[DevEmailSender] Assignment for {Email}: order {OrderNumber}, {Bytes} bytes\n{Details}",
                toEmail, orderNumber, pdfDocument.Length, assignmentDetails);
            return Task.CompletedTask;
        }
    }
}
