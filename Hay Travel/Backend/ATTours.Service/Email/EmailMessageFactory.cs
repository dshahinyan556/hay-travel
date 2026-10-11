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

        // Тексты 4 auth-писем здесь больше не живут (Notification Templates, 2026-08-31):
        // они переехали в NotificationTemplate (AuthService рендерит по Trigger, см. его
        // доккомент) и полностью редактируются админом — обычные записи, не защищённые.
        // Здесь остаётся только построение ссылок/URL: это инфраструктурная деталь (домен,
        // query-параметр токена), а не текст письма.

        // База может уже содержать query (?lang=ru) — тогда токен присоединяется через '&'.
        private static string AppendToken(string urlBase, string token)
        {
            var separator = urlBase.Contains('?') ? '&' : '?';
            return $"{urlBase}{separator}token={Uri.EscapeDataString(token)}";
        }
    }
}
