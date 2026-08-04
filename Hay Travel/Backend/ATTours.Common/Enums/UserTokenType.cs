namespace ATTours.Common.Enums
{
    // Назначение одноразового email-токена (ADR 006): одна таблица UserToken обслуживает
    // и подтверждение почты, и восстановление пароля — различаются только Type и TTL.
    public enum UserTokenType
    {
        EmailVerification = 1,
        PasswordReset = 2
    }
}
