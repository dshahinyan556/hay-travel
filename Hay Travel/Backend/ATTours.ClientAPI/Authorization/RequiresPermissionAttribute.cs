using ATTours.ClientAPI.Extensions;
using ATTours.Common.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ATTours.ClientAPI.Authorization
{
    // Гейт админ-эндпоинта по матрице прав вместо [Authorize(Roles = ...)]
    // (architecture-flexible-roles.md §2.4). В БД не ходит и DI не требует: права запечены
    // в access-токен при его выпуске (§2.6), фильтр только парсит claim.
    //
    // Ставится ПОМЕТОДНО поверх [Authorize] на контроллере: аутентификацию делает
    // JWT-конвейер, этот фильтр — только авторизацию.
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
    public sealed class RequiresPermissionAttribute(string screenKey, PermissionAction action)
        : Attribute, IAuthorizationFilter
    {
        public string ScreenKey { get; } = screenKey;

        public PermissionAction Action { get; } = action;

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            // Не аутентифицирован — 401, а не 403: клиенту нужно залогиниться/обновить
            // токен, а не узнать, что прав не хватает.
            if (context.HttpContext.User?.Identity?.IsAuthenticated != true)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            // Мгновенный отзыв после impersonation (spec 014 §8, ADR 030) — ПЕРВЫМ делом,
            // раньше любых проверок прав: SuperAdmin-байпас внутри HasPermission не должен
            // проскакивать мимо отзыва. 401, а не 403: токен мёртв, нужен новый.
            if (AccessTokenRevocationCheck.IsRevoked(context))
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            if (context.HttpContext.User.HasPermission(ScreenKey, Action))
                return;

            context.Result = new ForbidResult();
        }
    }
}
