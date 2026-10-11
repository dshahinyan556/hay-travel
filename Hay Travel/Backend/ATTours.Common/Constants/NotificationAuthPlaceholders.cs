using ATTours.Common.Enums;

namespace ATTours.Common.Constants
{
    // Токены auth-писем (Notification Templates, 2026-08-31): фиксированный набор ОДНОРАЗОВЫХ
    // токенов конкретного потока (ссылка/код), а не поля сущности User — заводить общий
    // динамический каталог ради 4 полей, которые ни разу не пересекаются между потоками,
    // избыточно (решение из checklist-notification-templates.txt, п.7).
    //
    // Эти 4 письма — ОБЫЧНЫЕ шаблоны (Давид явно поправил: не «системные»), просто
    // AuthService ищет нужный по NotificationTemplate.Trigger, а не по Id.
    public static class NotificationAuthPlaceholders
    {
        public const string UserName = nameof(UserName);
        public const string VerifyUrl = nameof(VerifyUrl);
        public const string ResetUrl = nameof(ResetUrl);
        public const string Code = nameof(Code);
        public const string ConfirmUrl = nameof(ConfirmUrl);

        private static readonly IReadOnlyDictionary<NotificationTemplateTrigger, string[]> TokensByTrigger =
            new Dictionary<NotificationTemplateTrigger, string[]>
            {
                [NotificationTemplateTrigger.None] = [],
                [NotificationTemplateTrigger.VerifyEmail] = [UserName, VerifyUrl],
                [NotificationTemplateTrigger.ResetPassword] = [UserName, ResetUrl],
                [NotificationTemplateTrigger.EmailChangeCode] = [UserName, Code],
                [NotificationTemplateTrigger.EmailChangeConfirm] = [UserName, ConfirmUrl]
            };

        public static IReadOnlyList<string> TokensFor(NotificationTemplateTrigger trigger)
            => TokensByTrigger.TryGetValue(trigger, out var tokens) ? tokens : [];

        public static List<string> WrappedTokensFor(NotificationTemplateTrigger trigger)
            => [.. TokensFor(trigger).Select(EmailPlaceholders.Wrap)];
    }
}
