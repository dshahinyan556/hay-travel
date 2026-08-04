using ATTours.Common.DTO.Auth;
using ATTours.Common.Entities;

namespace ATTours.BusinessServices.Security
{
    public interface IJwtTokenService
    {
        // Требует загруженного user.Role — роль попадает в claim и определяет доступ.
        AccessTokenModel CreateAccessToken(User user);

        GeneratedRefreshToken CreateRefreshToken();

        // Тот же алгоритм, что и при выдаче: нужен, чтобы найти строку по предъявленному
        // plaintext-токену из cookie.
        string HashRefreshToken(string token);
    }
}
