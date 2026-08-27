using ATTours.Common.DTO.Auth;

namespace ATTours.BusinessServices.Services.AuthServices
{
    // Данные вызова, которые знает только HTTP-слой, но которые обязаны попасть в аудит
    // токенов (UserToken.RequestIp/UserAgent, RefreshToken.CreatedByIp).
    public sealed record RequestContextModel(string IpAddress, string UserAgent);

    // Plaintext refresh-токена существует ровно на пути «сервис -> контроллер -> cookie»
    // и в API-моделях не появляется: в БД лежит только его SHA-256 хеш.
    //
    // RememberMe едет наружу (ADR 029), потому что от него зависит ПЕРСИСТЕНТНОСТЬ cookie:
    // на ротации контроллер сам не знает, была ли сессия «запомнена» — знает только строка
    // токена, которую читает сервис.
    public sealed record IssuedRefreshToken(string Token, DateTime ExpiresAtUtc, bool RememberMe);

    public sealed record LoginOutcome(LoginResultModel Result, IssuedRefreshToken RefreshToken);

    public sealed record RefreshOutcome(AccessTokenModel AccessToken, IssuedRefreshToken RefreshToken);
}
