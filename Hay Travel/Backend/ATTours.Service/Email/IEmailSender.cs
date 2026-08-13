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

        // Флоу заказов (B12, 2026-08-13): уведомление администратору о новой брони, ждущей
        // подтверждения — идёт на EmailSettings.AdminNotificationEmail, а не клиенту.
        Task SendNewOrderNotificationAsync(string tourTitle, DateOnly tourDate, int guestCount,
            string customerName, string customerEmail, CancellationToken cancellationToken = default);
    }
}
