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
    }
}
