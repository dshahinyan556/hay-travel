using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;

namespace ATTours.ClientAPI.Extensions
{
    public static class ClaimsPrincipalExtensions
    {
        // Id пользователя кладётся в claim "sub", но входной маппинг JwtBearer переименовывает
        // его в ClaimTypes.NameIdentifier — проверяем оба, чтобы не зависеть от MapInboundClaims.
        public static int GetUserId(this ClaimsPrincipal principal)
        {
            var rawValue = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                           ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

            if (!int.TryParse(rawValue, out var userId))
                throw new ErrorModelException(GlobalErrorCode.InvalidCredentials, HttpStatusCode.Unauthorized,
                    "Access token does not carry a valid user id.");

            return userId;
        }

        // Небросающий аналог GetUserId — нужен в middleware (B7), где throw недопустим:
        // отсутствие/невалидный claim там означает "пропустить трекинг", а не 401.
        public static bool TryGetUserId(this ClaimsPrincipal principal, out int userId)
        {
            var rawValue = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                           ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

            return int.TryParse(rawValue, out userId);
        }
    }
}
