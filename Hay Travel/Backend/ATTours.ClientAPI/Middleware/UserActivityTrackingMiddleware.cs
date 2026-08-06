using ATTours.BusinessServices.Services;
using ATTours.ClientAPI.Extensions;

namespace ATTours.ClientAPI.Middleware
{
    // Обновляет LastActiveAtUtc/LastLoginIp на каждый авторизованный запрос (B7, 2026-08-06).
    // Обычный ASP.NET Core middleware, НЕ через MiddlewareBase/InitializableMiddlewareBase —
    // та абстракция специфична для exception-chain, здесь нет ошибок, требующих обработки.
    // Регистрируется в Startup.ConfigureAdditionalMiddleware МЕЖДУ UseAuthentication()
    // и UseAuthorization() — активность считается по факту валидного токена, а не только
    // по успешно пройденной ролевой проверке.
    public class UserActivityTrackingMiddleware(RequestDelegate next)
    {
        public async Task InvokeAsync(HttpContext context)
        {
            if (context.User.Identity?.IsAuthenticated == true && context.User.TryGetUserId(out var userId))
            {
                var ip = ResolveIp(context);
                using var trackingService = new UserActivityTrackingService();
                await trackingService.TrackAsync(userId, ip, context.RequestAborted);
            }

            await next(context);
        }

        // X-Forwarded-For (первое значение) -> fallback RemoteIpAddress. app.UseForwardedHeaders
        // с KnownProxies/KnownNetworks под Azure App Service — отдельная задача, требующая
        // отдельного решения Давида (см. чек-лист B7), не блокирует остальной B7.
        private static string ResolveIp(HttpContext context)
        {
            var forwardedFor = context.Request.Headers["X-Forwarded-For"].ToString();
            if (!string.IsNullOrWhiteSpace(forwardedFor))
            {
                var firstValue = forwardedFor.Split(',')[0].Trim();
                if (!string.IsNullOrWhiteSpace(firstValue))
                    return Truncate(firstValue);
            }

            return Truncate(context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        }

        // Обрезка по длине колонки User.LastLoginIp (nvarchar(64)).
        private static string Truncate(string value) => value.Length <= 64 ? value : value[..64];
    }
}
