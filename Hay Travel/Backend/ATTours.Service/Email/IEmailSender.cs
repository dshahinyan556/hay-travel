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
    }
}
