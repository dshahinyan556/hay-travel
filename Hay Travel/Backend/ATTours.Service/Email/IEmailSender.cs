namespace ATTours.BusinessServices.Email
{
    public interface IEmailSender
    {
        // true у реализаций, которые письмо фактически не доставляют (локальная разработка):
        // AuthService в этом случае возвращает токен прямо в ответе API (MessageResultModel.DevToken),
        // иначе его неоткуда взять. Продакшн-реализация обязана возвращать false.
        bool ExposesTokenToCaller { get; }

        Task SendEmailVerificationAsync(string toEmail, string toName, string token, CancellationToken cancellationToken = default);

        Task SendPasswordResetAsync(string toEmail, string toName, string token, CancellationToken cancellationToken = default);

        // Email-change flow (B8, 2026-08-06). Шаг 1: числовой код на ТЕКУЩИЙ (старый) адрес.
        Task SendEmailChangeOldEmailCodeAsync(string toEmail, string toName, string code, CancellationToken cancellationToken = default);

        // Email-change flow (B8, 2026-08-06). Шаг 3: ссылка-подтверждение на НОВЫЙ адрес.
        Task SendEmailChangeConfirmationAsync(string toEmail, string toName, string token, CancellationToken cancellationToken = default);

        // Единая точка отправки писем ЗАКАЗОВ (Задача E, §E.9). Тема и HTML-тело приходят
        // уже отрендеренными из шаблона (OrderNotificationService) — транспорт ничего не
        // сочиняет и не решает, слать или нет. Раньше вместо этого метода было три
        // order-специфичных (NewOrderNotification/OrderDocument/Assignment) с текстами,
        // зашитыми в EmailMessageFactory; тексты переехали в БД, в EmailTemplate.
        //
        // Auth-методы выше остаются plaintext-специфичными: ими админ не управляет.
        Task SendTransactionalAsync(string toEmail, string toName, string subject, string bodyHtml,
            EmailAttachment? attachment = null, CancellationToken cancellationToken = default);

        // Письма заказов теперь уходят набору адресатов с копиями (редизайн 2026-08-23):
        // получатели настраиваются админом и могут включать Cc/Bcc. Однополучательская
        // перегрузка выше остаётся — ею пользуются auth-сценарии и она проще на вызове.
        Task SendTransactionalAsync(EmailRecipients recipients, string subject, string bodyHtml,
            EmailAttachment? attachment = null, CancellationToken cancellationToken = default);
    }
}
