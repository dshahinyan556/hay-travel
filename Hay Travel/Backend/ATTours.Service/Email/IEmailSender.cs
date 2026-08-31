namespace ATTours.BusinessServices.Email
{
    public interface IEmailSender
    {
        // true у реализаций, которые письмо фактически не доставляют (локальная разработка):
        // AuthService в этом случае возвращает токен прямо в ответе API (MessageResultModel.DevToken),
        // иначе его неоткуда взять. Продакшн-реализация обязана возвращать false.
        bool ExposesTokenToCaller { get; }

        // Единая точка отправки писем (Задача E, §E.9; Notification Templates, 2026-08-31).
        // Тема и HTML-тело приходят уже отрендеренными из шаблона — транспорт ничего не
        // сочиняет и не решает, слать или нет. Раньше здесь было ещё 4 auth-специфичных
        // метода (verify/reset/email-change) с текстами, зашитыми в EmailMessageFactory —
        // они переехали в NotificationTemplate (AuthService сам рендерит и вызывает эту же
        // единую точку, как заказы).
        Task SendTransactionalAsync(string toEmail, string toName, string subject, string bodyHtml,
            EmailAttachment? attachment = null, CancellationToken cancellationToken = default);

        // Письма заказов теперь уходят набору адресатов с копиями (редизайн 2026-08-23):
        // получатели настраиваются админом и могут включать Cc/Bcc. Однополучательская
        // перегрузка выше остаётся — ею пользуются auth-сценарии и она проще на вызове.
        Task SendTransactionalAsync(EmailRecipients recipients, string subject, string bodyHtml,
            EmailAttachment? attachment = null, CancellationToken cancellationToken = default);
    }
}
