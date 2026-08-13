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

        // Email-change flow (B8, 2026-08-06). Шаг 3-4: ссылка на НОВЫЙ email.
        public static string BuildEmailChangeConfirmUrl(EmailSettings settings, string token)
            => AppendToken(settings.EmailChangeConfirmUrlBase, token);

        public static string VerifySubject => "Подтверждение регистрации — Hay Travel";

        public static string ResetSubject => "Восстановление пароля — Hay Travel";

        public static string EmailChangeCodeSubject => "Код подтверждения смены почты — Hay Travel";

        public static string EmailChangeConfirmSubject => "Подтверждение нового адреса почты — Hay Travel";

        public static string BuildVerifyBody(string toName, string verifyUrl)
            => $"Здравствуйте, {toName}!\n\n" +
               $"Чтобы завершить регистрацию, подтвердите адрес почты: {verifyUrl}\n\n" +
               "Ссылка действует 1 час. Если вы не регистрировались, просто проигнорируйте это письмо.";

        public static string BuildResetBody(string toName, string resetUrl)
            => $"Здравствуйте, {toName}!\n\n" +
               $"Для смены пароля перейдите по ссылке: {resetUrl}\n\n" +
               "Ссылка действует 1 час. Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.";

        public static string BuildEmailChangeCodeBody(string toName, string code)
            => $"Здравствуйте, {toName}!\n\n" +
               $"Код подтверждения для смены адреса почты: {code}\n\n" +
               "Код действует 15 минут. Если вы не запрашивали смену почты, просто проигнорируйте это письмо.";

        public static string BuildEmailChangeConfirmBody(string toName, string confirmUrl)
            => $"Здравствуйте, {toName}!\n\n" +
               $"Чтобы подтвердить новый адрес почты, перейдите по ссылке: {confirmUrl}\n\n" +
               "Ссылка действует 1 час. Если вы не запрашивали смену почты, просто проигнорируйте это письмо.";

        public static string NewOrderNotificationSubject => "Новая заявка на бронь — Hay Travel";

        public static string BuildNewOrderNotificationBody(string tourTitle, DateOnly tourDate, int guestCount,
            string customerName, string customerEmail)
            => $"Новая заявка ждёт подтверждения в админке.\n\n" +
               $"Тур: {tourTitle}\n" +
               $"Дата: {tourDate:yyyy-MM-dd}\n" +
               $"Гостей: {guestCount}\n" +
               $"Клиент: {customerName} ({customerEmail})\n\n" +
               "Подтвердите или отмените заявку в разделе «Заказы» админ-панели.";

        // База может уже содержать query (?lang=ru) — тогда токен присоединяется через '&'.
        private static string AppendToken(string urlBase, string token)
        {
            var separator = urlBase.Contains('?') ? '&' : '?';
            return $"{urlBase}{separator}token={Uri.EscapeDataString(token)}";
        }
    }
}
