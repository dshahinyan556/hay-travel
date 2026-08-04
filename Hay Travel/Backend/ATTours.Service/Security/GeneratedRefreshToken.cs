namespace ATTours.BusinessServices.Security
{
    // Пара «то, что уходит клиенту» / «то, что ложится в БД». Plaintext существует
    // ровно один раз — в момент выдачи; в RefreshToken.TokenHash хранится только хеш.
    public sealed record GeneratedRefreshToken(string Token, string TokenHash, DateTime ExpiresAtUtc);
}
