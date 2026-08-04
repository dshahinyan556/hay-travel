using ATTours.BusinessServices.Services.AuthServices;
using ATTours.ClientAPI.Extensions;
using ATTours.Common.DTO.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    // Auth-вертикаль получает сервисы через конструктор, а не через `new` (ADR 005).
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous]
    public class AuthController(IAuthService authService) : Controller
    {
        // Refresh-токен живёт только в httpOnly-cookie: он недоступен JavaScript, поэтому
        // XSS не может его украсть, а Path сужает отправку до самих auth-эндпоинтов.
        private const string RefreshTokenCookieName = "att_refresh";
        private const string RefreshTokenCookiePath = "/api/Auth";

        [HttpPost]
        [Route("Register")]
        public async Task<MessageResultModel> RegisterAsync([FromBody] RegisterModel model, CancellationToken cancellationToken)
            => await authService.RegisterAsync(model, BuildRequestContext(), cancellationToken);

        [HttpPost]
        [Route("VerifyEmail")]
        public async Task<MessageResultModel> VerifyEmailAsync([FromBody] VerifyEmailModel model, CancellationToken cancellationToken)
            => await authService.VerifyEmailAsync(model, cancellationToken);

        [HttpPost]
        [Route("Login")]
        public async Task<LoginResultModel> LoginAsync([FromBody] LoginModel model, CancellationToken cancellationToken)
        {
            var outcome = await authService.LoginAsync(model, BuildRequestContext(), cancellationToken);
            SetRefreshTokenCookie(outcome.RefreshToken);
            return outcome.Result;
        }

        [HttpPost]
        [Route("RefreshToken")]
        public async Task<AccessTokenModel> RefreshTokenAsync(CancellationToken cancellationToken)
        {
            var refreshToken = Request.Cookies[RefreshTokenCookieName];

            // Cookie гасится заранее: при невалидном токене метод бросает исключение и
            // до сюда уже не возвращается, а браузер не должен хранить мёртвую сессию.
            ClearRefreshTokenCookie();

            var outcome = await authService.RefreshAsync(refreshToken, BuildRequestContext(), cancellationToken);
            SetRefreshTokenCookie(outcome.RefreshToken);
            return outcome.AccessToken;
        }

        [HttpPost]
        [Route("Logout")]
        public async Task<IActionResult> LogoutAsync(CancellationToken cancellationToken)
        {
            await authService.LogoutAsync(Request.Cookies[RefreshTokenCookieName], cancellationToken);
            ClearRefreshTokenCookie();
            return NoContent();
        }

        [HttpPost]
        [Route("ForgotPassword")]
        public async Task<MessageResultModel> ForgotPasswordAsync([FromBody] ForgotPasswordModel model, CancellationToken cancellationToken)
            => await authService.ForgotPasswordAsync(model, BuildRequestContext(), cancellationToken);

        [HttpPost]
        [Route("ResetPassword")]
        public async Task<MessageResultModel> ResetPasswordAsync([FromBody] ResetPasswordModel model, CancellationToken cancellationToken)
        {
            var result = await authService.ResetPasswordAsync(model, cancellationToken);

            // Сброс пароля отзывает все сессии, включая текущую.
            ClearRefreshTokenCookie();
            return result;
        }

        [HttpPost]
        [Route("ChangePassword")]
        [Authorize]
        public async Task<MessageResultModel> ChangePasswordAsync([FromBody] ChangePasswordModel model, CancellationToken cancellationToken)
            => await authService.ChangePasswordAsync(User.GetUserId(), model, Request.Cookies[RefreshTokenCookieName], cancellationToken);

        #region Helpers

        // Обрезка по длинам колонок UserToken.RequestIp/UserAgent: User-Agent приходит
        // от клиента и вполне может быть длиннее, а падать на этом аудит-полю незачем.
        private RequestContextModel BuildRequestContext()
            => new(Truncate(HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown", 64),
                   Truncate(Request.Headers.UserAgent.ToString(), 512));

        private static string Truncate(string value, int maxLength)
            => value.Length <= maxLength ? value : value[..maxLength];

        private void SetRefreshTokenCookie(IssuedRefreshToken refreshToken)
            => Response.Cookies.Append(RefreshTokenCookieName, refreshToken.Token, BuildCookieOptions(
                new DateTimeOffset(refreshToken.ExpiresAtUtc, TimeSpan.Zero)));

        private void ClearRefreshTokenCookie()
            => Response.Cookies.Delete(RefreshTokenCookieName, BuildCookieOptions(null));

        // Domain намеренно не задаётся: браузер привяжет cookie к хосту запроса, что
        // остаётся верным и при будущем проксировании фронта и API через один origin.
        private static CookieOptions BuildCookieOptions(DateTimeOffset? expires) => new()
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Path = RefreshTokenCookiePath,
            IsEssential = true,
            Expires = expires
        };

        #endregion
    }
}
