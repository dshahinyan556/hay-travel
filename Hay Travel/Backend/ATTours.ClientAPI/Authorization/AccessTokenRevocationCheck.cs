using ATTours.ClientAPI.Extensions;
using ATTours.Helper.Security;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ATTours.ClientAPI.Authorization
{
    // Общая пред-проверка мгновенного отзыва access-токена (spec 014 §8, ADR 030) для трёх
    // permission-фильтров. Вынесена сюда, а не продублирована в каждом: расхождение между
    // копиями молча открыло бы дыру ровно там, где она и опасна.
    //
    // Атрибуты не умеют конструкторный DI, поэтому синглтон реестра достаётся из
    // RequestServices — это разрешение из уже собранного контейнера, не `new`.
    internal static class AccessTokenRevocationCheck
    {
        public static bool IsRevoked(AuthorizationFilterContext context)
        {
            var registry = context.HttpContext.RequestServices.GetRequiredService<IAccessTokenRevocationRegistry>();
            return context.HttpContext.User.IsAccessTokenRevoked(registry);
        }
    }
}
