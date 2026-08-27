using ATTours.BusinessServices.Services.AuthServices;

namespace ATTours.ClientAPI.Authorization
{
    // Единственное место, где задаются имя/путь/флаги refresh-cookie (spec 014 §4.4).
    // Вынесено из AuthController, потому что cookie теперь ставит ещё и UsersController
    // (impersonation): две копии конфигурации разъехались бы, и «выход» гасил бы не ту
    // cookie, что «вход».
    //
    // Refresh-токен живёт только в httpOnly-cookie: он недоступен JavaScript, поэтому XSS
    // не может его украсть, а Path сужает отправку до самих auth-эндпоинтов.
    public static class RefreshTokenCookie
    {
        public const string Name = "att_refresh";
        public const string Path = "/api/Auth";

        // Персистентность cookie обязана совпадать с серверным окном (ADR 029):
        // без «запомнить меня» — сессионная cookie (умирает с браузером) поверх часового
        // окна неактивности; с ним — постоянная, ровно до ExpiresAtUtc токена.
        public static void Set(HttpResponse response, IssuedRefreshToken refreshToken, bool rememberMe)
            => response.Cookies.Append(Name, refreshToken.Token,
                Options(rememberMe ? new DateTimeOffset(refreshToken.ExpiresAtUtc, TimeSpan.Zero) : null));

        public static void Clear(HttpResponse response)
            => response.Cookies.Delete(Name, Options(null));

        // Domain намеренно не задаётся: браузер привяжет cookie к хосту запроса, что
        // остаётся верным и при проксировании фронта и API через один origin.
        public static CookieOptions Options(DateTimeOffset? expires) => new()
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Path = Path,
            IsEssential = true,
            Expires = expires
        };
    }
}
