using ATTours.ClientAPI.Extensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ATTours.ClientAPI.Authorization
{
    // Гейт «войти как пользователь» (spec 014 §2.4). Привилегия сквозная, а не действие над
    // экраном, поэтому отдельный фильтр, а не [RequiresPermission]: в БД не ходит, читает
    // только claim can_impersonate, запечённый при выпуске токена.
    //
    // Ставится ПОМЕТОДНО поверх [Authorize] на контроллере: аутентификацию делает
    // JWT-конвейер, этот фильтр — только авторизацию.
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
    public sealed class RequiresImpersonateAttribute : Attribute, IAuthorizationFilter
    {
        public void OnAuthorization(AuthorizationFilterContext context)
        {
            // Не аутентифицирован — 401, а не 403: клиенту нужно залогиниться/обновить
            // токен, а не узнать, что прав не хватает.
            if (context.HttpContext.User?.Identity?.IsAuthenticated != true)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            // Мгновенный отзыв после impersonation (spec 014 §8, ADR 030) — первым делом:
            // иначе админ со «старым» токеном мог бы цепочкой войти в следующий аккаунт.
            if (AccessTokenRevocationCheck.IsRevoked(context))
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            if (context.HttpContext.User.CanImpersonate())
                return;

            context.Result = new ForbidResult();
        }
    }
}
