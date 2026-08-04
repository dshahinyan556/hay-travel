using ATTours.Common.Settings;

namespace ATTours.BusinessServices.Email
{
    // Тексты и ссылки писем живут в одном месте: dev- и SendGrid-реализации обязаны
    // слать пользователю одно и то же, различаться должен только транспорт.
    internal static class EmailMessageFactory
    {
        public static string BuildVerifyUrl(EmailSettings settings, string token)
            => AppendToken(settings.VerifyUrlBase, token);

        public static string BuildResetUrl(EmailSettings settings, string token)
            => AppendToken(settings.ResetUrlBase, token);

        public static string VerifySubject => "Подтверждение регистрации — Hay Travel";

        public static string ResetSubject => "Восстановление пароля — Hay Travel";

        public static string BuildVerifyBody(string toName, string verifyUrl)
            => $"Здравствуйте, {toName}!\n\n" +
               $"Чтобы завершить регистрацию, подтвердите адрес почты: {verifyUrl}\n\n" +
               "Ссылка действует 1 час. Если вы не регистрировались, просто проигнорируйте это письмо.";

        public static string BuildResetBody(string toName, string resetUrl)
            => $"Здравствуйте, {toName}!\n\n" +
               $"Для смены пароля перейдите по ссылке: {resetUrl}\n\n" +
               "Ссылка действует 1 час. Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.";

        // База может уже содержать query (?lang=ru) — тогда токен присоединяется через '&'.
        private static string AppendToken(string urlBase, string token)
        {
            var separator = urlBase.Contains('?') ? '&' : '?';
            return $"{urlBase}{separator}token={Uri.EscapeDataString(token)}";
        }
    }
}
