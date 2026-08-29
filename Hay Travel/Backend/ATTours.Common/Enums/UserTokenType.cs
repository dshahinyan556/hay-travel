namespace ATTours.Common.Enums
{
    // Назначение одноразового email-токена (ADR 006): одна таблица UserToken обслуживает
    // и подтверждение почты, и восстановление пароля — различаются только Type и TTL.
    public enum UserTokenType
    {
        EmailVerification = 1,
        PasswordReset = 2,

        // Одноразовый код привязки Telegram-аккаунта (ADR 031 §4): та же машина, что
        // verify/reset, отличаются только TTL (Telegram:LinkCodeLifetimeMinutes) и алфавит
        // кода (base64url из 18 байт — ограничение deep-link'а ?start=<payload>).
        TelegramLink = 3
    }
}
