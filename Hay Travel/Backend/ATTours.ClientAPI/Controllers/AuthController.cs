using ATTours.BusinessServices.Services.AuthServices;
using ATTours.ClientAPI.Authorization;
using ATTours.ClientAPI.Extensions;
using ATTours.Common.DTO.Auth;
using ATTours.Common.DTO.Authorization;
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
        [HttpPost]
        [Route("Register")]
        public async Task<MessageResultModel> RegisterAsync([FromBody] RegisterModel model, CancellationToken cancellationToken)
            => await authService.RegisterAsync(model, BuildRequestContext(), cancellationToken);

        // Переотправка письма подтверждения (2026-08-27): до неё единственным способом было
        // заново отправить всю форму регистрации. Ответ generic и при кулдауне, и при
        // неизвестном адресе — см. AuthService.ResendVerificationEmailAsync.
        [HttpPost]
        [Route("ResendVerification")]
        public async Task<MessageResultModel> ResendVerificationAsync([FromBody] ResendVerificationModel model, CancellationToken cancellationToken)
            => await authService.ResendVerificationEmailAsync(model, BuildRequestContext(), cancellationToken);

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
            var refreshToken = Request.Cookies[RefreshTokenCookie.Name];

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
            await authService.LogoutAsync(Request.Cookies[RefreshTokenCookie.Name], cancellationToken);
            ClearRefreshTokenCookie();
            return NoContent();
        }

        // Резолвленный (роль + персональный override) набор прав текущего пользователя —
        // по нему админка строит гарды роутера и enable/disable кнопок
        // (architecture-flexible-roles.md §4.1). Всегда свежий из БД: UI не ждёт ротации
        // access-токена, хотя enforcement на бэке идёт по запечённому в токен набору.
        [HttpGet]
        [Route("MyPermissions")]
        [Authorize]
        public async Task<MyPermissionsModel> MyPermissionsAsync(CancellationToken cancellationToken)
            => await authService.GetMyPermissionsAsync(User.GetUserId(), cancellationToken);

        // Управление своими сессиями/устройствами (spec 017 §4). [Authorize] пометодно, как
        // у MyPermissions: сам контроллер [AllowAnonymous]. Пользователь всегда из токена,
        // никогда из маршрута/тела — иначе это был бы прямой IDOR по чужим сессиям.
        [HttpGet]
        [Route("Sessions")]
        [Authorize]
        public async Task<List<SessionInfoModel>> GetMySessionsAsync(CancellationToken cancellationToken)
            => await authService.GetMySessionsAsync(User.GetUserId(), Request.Cookies[RefreshTokenCookie.Name], cancellationToken);

        // Отзыв одной своей сессии. Cookie здесь не трогаем: гасить можно и текущую строку —
        // тогда браузер сам получит 401 на ближайшей ротации и разлогинится штатно.
        [HttpDelete]
        [Route("Sessions/{id:int}")]
        [Authorize]
        public async Task<IActionResult> RevokeMySessionAsync(int id, CancellationToken cancellationToken)
        {
            await authService.RevokeMySessionAsync(User.GetUserId(), id, cancellationToken);
            return NoContent();
        }

        // «Выйти на других устройствах»: текущая сессия остаётся живой, поэтому cookie
        // тоже не трогаем.
        [HttpPost]
        [Route("Sessions/RevokeOthers")]
        [Authorize]
        public async Task<IActionResult> RevokeMyOtherSessionsAsync(CancellationToken cancellationToken)
        {
            await authService.RevokeMyOtherSessionsAsync(User.GetUserId(), Request.Cookies[RefreshTokenCookie.Name], cancellationToken);
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
            => await authService.ChangePasswordAsync(User.GetUserId(), model, Request.Cookies[RefreshTokenCookie.Name], cancellationToken);

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

        // Конфигурация самой cookie — в RefreshTokenCookie (её ставит ещё и UsersController
        // при impersonation); IssuedRefreshToken.RememberMe решает, сессионная она или
        // постоянная (ADR 029).
        private RequestContextModel BuildRequestContext()
            => HttpContext.BuildRequestContext();

        private void SetRefreshTokenCookie(IssuedRefreshToken refreshToken)
            => RefreshTokenCookie.Set(Response, refreshToken, refreshToken.RememberMe);

        private void ClearRefreshTokenCookie()
            => RefreshTokenCookie.Clear(Response);

        #endregion
    }
}
