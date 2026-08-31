namespace ATTours.Helper.Security
{
    // Мгновенный отзыв access-токенов ОДНОЙ сессии (David, 2026-08-31). Пара к
    // IAccessTokenRevocationRegistry, но по-другому ключуется: тот бьёт по ВСЕМ токенам
    // пользователя (единственный вызывающий — ImpersonateAsync, где это и нужно), этот —
    // по TokenHash конкретного refresh-токена, ровно той сессии, которую завершили
    // («Завершить сеанс», «Завершить остальные», принудительный логаут админом). Точечность
    // обязательна: завершение ЧУЖОЙ сессии не должно попутно выбивать ту, с которой его
    // вызвали.
    //
    // In-memory, single-instance — та же оговорка, что у IAccessTokenRevocationRegistry:
    // при появлении второй реплики бэкенда реализация меняется на общий стор (Redis)
    // за тем же интерфейсом, без правок на местах вызова.
    public interface ISessionRevocationRegistry
    {
        // Быстрый путь для запроса, у которого не отозвана ни одна сессия вообще.
        bool IsEmpty { get; }

        // Отозвать access-токены сессии sessionTokenHash, выпущенные до cutoffUtc, до
        // entryExpiresUtc. Вызывается из RevokeSessionAsync/RevokeAllRefreshTokensAsync —
        // ровно там, где соответствующий RefreshToken.RevokedAtUtc проставляется.
        void Revoke(string sessionTokenHash, DateTime cutoffUtc, DateTime entryExpiresUtc);

        // true, если для sessionTokenHash есть живая запись и токен выпущен (iat) до её
        // CutoffUtc. now берётся внутри для проверки живости записи.
        bool IsRevoked(string sessionTokenHash, DateTime tokenIssuedAtUtc);
    }
}
