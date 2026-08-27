namespace ATTours.Helper.Security
{
    // Мгновенный отзыв access-токенов пользователя после impersonation (spec 014 §8, ADR 030).
    // In-memory, single-instance. Проверяется ТОЛЬКО в permission-атрибутах, не на каждом запросе.
    //
    // Интерфейс существует ради одного будущего сценария: при переходе на >1 реплики бэкенда
    // реализация меняется на общую (Redis/IDistributedCache) с той же формой ключ/значение/TTL,
    // и это правка ровно одного класса, без изменений на местах вызова (ADR 030).
    public interface IAccessTokenRevocationRegistry
    {
        // Быстрый путь для 99.9% запросов: пусто -> проверять нечего, парсить claim'ы не нужно.
        bool IsEmpty { get; }

        // Отозвать все access-токены пользователя, выпущенные до cutoffUtc, до entryExpiresUtc.
        // Вызывается ТОЛЬКО из AuthService.ImpersonateAsync (единственный триггер).
        void Revoke(int userId, DateTime cutoffUtc, DateTime entryExpiresUtc);

        // true, если для userId есть живая запись и токен выпущен (iat) до её CutoffUtc.
        // now берётся внутри (DateTime.UtcNow) для проверки живости записи.
        bool IsRevoked(int userId, DateTime tokenIssuedAtUtc);
    }
}
