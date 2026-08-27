using ATTours.BusinessServices.Services.AuthServices;

namespace ATTours.ClientAPI.Extensions
{
    public static class HttpContextExtensions
    {
        // Данные вызова для аудита токенов и событий (UserToken.RequestIp/UserAgent,
        // RefreshToken.CreatedByIp, LoginHistory, ImpersonationEvent). Был приватным
        // методом AuthController — вынесен, потому что impersonation пишет тот же аудит
        // из UsersController (spec 014 §3.4).
        //
        // Обрезка по длинам соответствующих колонок: User-Agent приходит от клиента и
        // вполне может быть длиннее, а падать на этом аудит-поле незачем.
        public static RequestContextModel BuildRequestContext(this HttpContext httpContext)
            => new(Truncate(httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown", 64),
                   Truncate(httpContext.Request.Headers.UserAgent.ToString(), 512));

        private static string Truncate(string value, int maxLength)
            => value.Length <= maxLength ? value : value[..maxLength];
    }
}
