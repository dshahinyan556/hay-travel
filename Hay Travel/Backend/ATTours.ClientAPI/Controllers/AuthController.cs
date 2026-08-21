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
    public class AuthController(IAuthService authService, IWebHostEnvironment env) : Controller
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

        // Дев-бэкдор для локального UI-тестирования без пароля (Давид, 2026-08-16,
        // checklist-orders-redesign.txt) — 404 в любом окружении, кроме Development
        // (Dockerfile прода всегда ставит ASPNETCORE_ENVIRONMENT=Production). НИКОГДА не
        // должен быть достижим в проде — это единственная защита, поэтому проверка тут,
        // а не только "полагаться" на то, что её не вызовут.
        [HttpPost]
        [Route("DevLogin")]
        public async Task<ActionResult<LoginResultModel>> DevLoginAsync([FromQuery] string email, CancellationToken cancellationToken)
        {
            if (!env.IsDevelopment())
                return NotFound();

            var outcome = await authService.DevLoginAsync(email, BuildRequestContext(), cancellationToken);
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

        // Email-change flow (B8, 2026-08-06). Шаг 1: код на ТЕКУЩИЙ email — без тела.
        [HttpPost]
        [Route("RequestEmailChange")]
        [Authorize]
        public async Task<MessageResultModel> RequestEmailChangeAsync(CancellationToken cancellationToken)
            => await authService.RequestEmailChangeAsync(User.GetUserId(), BuildRequestContext(), cancellationToken);

        // Шаг 2: подтверждение кода, присланного на старый email.
        [HttpPost]
        [Route("ConfirmEmailChangeCode")]
        [Authorize]
        public async Task<MessageResultModel> ConfirmEmailChangeCodeAsync([FromBody] ConfirmEmailChangeCodeModel model, CancellationToken cancellationToken)
            => await authService.ConfirmEmailChangeCodeAsync(User.GetUserId(), model, cancellationToken);

        // Шаг 3: новый email — генерит ссылку-подтверждение и шлёт её на НОВЫЙ адрес.
        [HttpPost]
        [Route("RequestNewEmail")]
        [Authorize]
        public async Task<MessageResultModel> RequestNewEmailAsync([FromBody] RequestNewEmailModel model, CancellationToken cancellationToken)
            => await authService.RequestNewEmailAsync(User.GetUserId(), model, BuildRequestContext(), cancellationToken);

        // Шаг 4: переход по ссылке из письма на новый email. AllowAnonymous — тот же паттерн,
        // что VerifyEmail: ссылка может открыться в сессии без живого access-токена.
        [HttpPost]
        [Route("ConfirmEmailChange")]
        public async Task<MessageResultModel> ConfirmEmailChangeAsync([FromBody] ConfirmEmailChangeModel model, CancellationToken cancellationToken)
            => await authService.ConfirmEmailChangeAsync(model, cancellationToken);

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
