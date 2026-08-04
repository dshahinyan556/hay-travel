using ATTours.Common.DTO.Auth;

namespace ATTours.BusinessServices.Services.AuthServices
{
    public interface IAuthService
    {
        // Существующий email не отличим по ответу от нового: возвращается то же
        // generic-сообщение, а неверифицированному аккаунту повторно уходит письмо.
        Task<MessageResultModel> RegisterAsync(RegisterModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        Task<MessageResultModel> VerifyEmailAsync(VerifyEmailModel model, CancellationToken cancellationToken = default);

        Task<LoginOutcome> LoginAsync(LoginModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        // Ротация с reuse-detection: предъявленный уже отозванный токен отзывает все
        // сессии пользователя.
        Task<RefreshOutcome> RefreshAsync(string? refreshToken, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        // Идемпотентен: отсутствующий/уже отозванный токен — не ошибка.
        Task LogoutAsync(string? refreshToken, CancellationToken cancellationToken = default);

        // Всегда generic-ответ, независимо от того, существует ли аккаунт.
        Task<MessageResultModel> ForgotPasswordAsync(ForgotPasswordModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        Task<MessageResultModel> ResetPasswordAsync(ResetPasswordModel model, CancellationToken cancellationToken = default);

        // currentRefreshToken — plaintext из cookie: эта сессия переживает смену пароля,
        // остальные отзываются. null допустим (тогда отзываются все).
        Task<MessageResultModel> ChangePasswordAsync(int userId, ChangePasswordModel model, string? currentRefreshToken, CancellationToken cancellationToken = default);
    }
}
