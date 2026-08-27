using ATTours.ClientAPI.Extensions;
using ATTours.Common.Authorization;
using ATTours.Common.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ATTours.ClientAPI.Authorization
{
    // То же, что [RequiresPermission], но пускает, если разрешено ЛЮБОЕ из перечисленных
    // (screenKey, action). Нужен кросс-скрин утилитам вроде Upload/Image: право загрузить
    // картинку производно от права редактировать контент, в котором она используется
    // (architecture-flexible-roles.md §2.5).
    //
    // Формат пары — "ключ:Действие" ("products:Update"). Строка, а не типизированные
    // аргументы, потому что атрибут принимает только константы: пары собираются из
    // AdminScreens-констант конкатенацией и проверяются здесь же при разборе.
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
    public sealed class RequiresAnyPermissionAttribute : Attribute, IAuthorizationFilter
    {
        private const char PairSeparator = ':';

        private readonly (string ScreenKey, PermissionAction Action)[] requirements;

        public RequiresAnyPermissionAttribute(params string[] screenActionPairs)
        {
            requirements = (screenActionPairs ?? [])
                .Select(Parse)
                .ToArray();
        }

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            if (context.HttpContext.User?.Identity?.IsAuthenticated != true)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            // Мгновенный отзыв после impersonation (spec 014 §8, ADR 030) — до любых
            // проверок прав, включая SuperAdmin-байпас внутри HasPermission.
            if (AccessTokenRevocationCheck.IsRevoked(context))
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            var principal = context.HttpContext.User;
            foreach (var (screenKey, action) in requirements)
            {
                if (principal.HasPermission(screenKey, action))
                    return;
            }

            context.Result = new ForbidResult();
        }

        // Опечатка в паре — это баг кода, а не запрос пользователя: падаем громко, а не
        // молча закрываем эндпоинт (что выглядело бы как «права не выданы»).
        private static (string ScreenKey, PermissionAction Action) Parse(string pair)
        {
            var separatorIndex = pair?.LastIndexOf(PairSeparator) ?? -1;
            if (pair is null || separatorIndex <= 0 || separatorIndex == pair.Length - 1)
                throw new ArgumentException($"Permission pair '{pair}' must be in the form 'screenKey:Action'.", nameof(pair));

            var screenKey = pair[..separatorIndex];
            var rawAction = pair[(separatorIndex + 1)..];

            if (!AdminScreens.IsKnown(screenKey))
                throw new ArgumentException($"Unknown admin screen key '{screenKey}'.", nameof(pair));

            if (!Enum.TryParse<PermissionAction>(rawAction, ignoreCase: true, out var action))
                throw new ArgumentException($"Unknown permission action '{rawAction}'.", nameof(pair));

            return (screenKey, action);
        }
    }
}
