using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using Microsoft.Extensions.Logging;

namespace ATTours.BusinessServices.Notifications
{
    // Один разложенный адресат письма. Employee != null только у персональных писем
    // исполнителю: у такого письма своё тело (свои детали) и своё вложение, поэтому в общую
    // рассылку оно не сливается.
    public sealed class ResolvedRecipient
    {
        public string Address { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public NotificationRecipientType Type { get; init; } = NotificationRecipientType.To;
        public LanguageCode Language { get; init; } = LanguageCode.Russian;

        public OrderEmployeeRecipient? Employee { get; init; }
    }

    // Разворачивает настроенные админом строки-получатели в конкретные адреса. Единственный
    // источник правды о том, кому уходит письмо: зашитая в код логика (админский ящик /
    // исполнитель / клиент) удалена и переехала в сид миграции.
    //
    // Создаётся через `new` внутри OrderNotificationService — обычный паттерн info-сервисов
    // проекта; из DI приходят только EmailSettings и логгер владеющего сервиса.
    public class NotificationRecipientResolver
    {
        private readonly EmailSettings emailSettings;
        private readonly ILogger logger;

        public NotificationRecipientResolver(EmailSettings emailSettings, ILogger logger)
        {
            this.emailSettings = emailSettings;
            this.logger = logger;
        }

        public async Task<List<ResolvedRecipient>> ResolveAsync(EmailActionKey key,
            NotificationPlatform platform, OrderNotificationContext context,
            CancellationToken cancellationToken)
        {
            using var info = new NotificationSettingsInfo(CommonSettings.Instance.ATToursConnectionString,
                cancellationToken);

            // Выключенный канал — тихий no-op, а не ошибка операции: назначение/бронь уже
            // сохранены, и отсутствие письма это осознанная настройка админа.
            if (!await info.IsChannelEnabledAsync(key, platform))
                return [];

            var rows = await info.GetActiveRecipientsAsync(key, platform);

            var resolved = new List<ResolvedRecipient>();

            foreach (var row in rows)
                resolved.AddRange(Expand(row, context));

            return Deduplicate(resolved);
        }

        private IEnumerable<ResolvedRecipient> Expand(NotificationRecipient row, OrderNotificationContext context)
        {
            // Type осмыслен только у Email; у Telegram он null (валидация это гарантирует),
            // и подстановка To ни на что не влияет — отправки всё равно нет.
            var type = row.Type ?? NotificationRecipientType.To;

            switch (row.SourceType)
            {
                case NotificationRecipientSource.User:
                    return ExpandUser(row, type);

                case NotificationRecipientSource.AdminMailbox:
                    return ExpandAdminMailbox(row, type);

                case NotificationRecipientSource.CustomEmail:
                    return ExpandCustomEmail(row, type);

                case NotificationRecipientSource.OrderLinked:
                    return ExpandOrderLinked(row, type, context);

                default:
                    logger.LogWarning("Notification recipient {RecipientId} has unknown source type {SourceType}; skipped.",
                        row.Id, (int)row.SourceType);
                    return [];
            }
        }

        // Удалённый (soft-delete) пользователь строку не уносит — она просто перестаёт
        // резолвиться, как и договорено в конфигурации FK (SetNull).
        private IEnumerable<ResolvedRecipient> ExpandUser(NotificationRecipient row, NotificationRecipientType type)
        {
            if (row.UserId is null || row.User is null || row.User.IsDeleted
                || string.IsNullOrWhiteSpace(row.User.Email))
            {
                logger.LogWarning("Notification recipient {RecipientId} points to a missing/deleted user; skipped.", row.Id);
                return [];
            }

            return
            [
                new ResolvedRecipient
                {
                    Address = row.User.Email,
                    Name = $"{row.User.FirstName} {row.User.LastName}".Trim(),
                    Type = type,
                    Language = row.User.PreferredLanguage
                }
            ];
        }

        // Адрес читается из конфигурации на отправке, а не хардкодится в сид миграции:
        // Email:AdminNotificationEmail в prod и dev разный.
        private IEnumerable<ResolvedRecipient> ExpandAdminMailbox(NotificationRecipient row, NotificationRecipientType type)
        {
            var address = emailSettings.AdminNotificationEmail;

            if (string.IsNullOrWhiteSpace(address))
            {
                logger.LogWarning("Notification recipient {RecipientId} uses the admin mailbox, but " +
                    "Email:AdminNotificationEmail resolves to an empty address; skipped.", row.Id);
                return [];
            }

            return
            [
                new ResolvedRecipient
                {
                    Address = address,
                    Name = emailSettings.FromName,
                    Type = type,
                    // Системный ящик читают админы — язык всегда RU (решение Давида).
                    Language = LanguageCode.Russian
                }
            ];
        }

        private IEnumerable<ResolvedRecipient> ExpandCustomEmail(NotificationRecipient row, NotificationRecipientType type)
        {
            if (string.IsNullOrWhiteSpace(row.CustomEmail))
            {
                logger.LogWarning("Notification recipient {RecipientId} has an empty custom email; skipped.", row.Id);
                return [];
            }

            var address = row.CustomEmail.Trim();

            return
            [
                new ResolvedRecipient
                {
                    Address = address,
                    // Имени у свободного ввода нет — показываем сам адрес.
                    Name = address,
                    Type = type,
                    // У произвольного адреса пользователя в системе нет, спросить язык не у кого
                    // (решение Давида: всегда RU).
                    Language = LanguageCode.Russian
                }
            ];
        }

        private IEnumerable<ResolvedRecipient> ExpandOrderLinked(NotificationRecipient row,
            NotificationRecipientType type, OrderNotificationContext context)
        {
            if (row.OrderLinkedRole is null)
            {
                logger.LogWarning("Notification recipient {RecipientId} is order-linked but has no role; skipped.", row.Id);
                return [];
            }

            if (row.OrderLinkedRole == OrderLinkedRecipient.Client)
            {
                var order = context?.Order;

                if (order is null || string.IsNullOrWhiteSpace(order.UserEmail))
                    return [];

                return
                [
                    new ResolvedRecipient
                    {
                        Address = order.UserEmail,
                        Name = order.UserFullName,
                        Type = type,
                        Language = order.UserPreferredLanguage
                    }
                ];
            }

            // Исполнитель: по одному адресату на каждого исполнителя ЭТОГО вызова. Пустой
            // список — ноль адресатов, а не ошибка (например, у OrderCreated исполнителей нет).
            var employees = context?.Employees ?? [];

            return employees
                .Where(employee => !string.IsNullOrWhiteSpace(employee.Email))
                .Select(employee => new ResolvedRecipient
                {
                    Address = employee.Email,
                    Name = employee.FullName,
                    // Type у исполнителя игнорируется: письмо персональное (его детали, его
                    // PDF) — поставить такого получателя в Cc/Bcc чужого письма нельзя,
                    // не показав ему чужие данные.
                    Type = NotificationRecipientType.To,
                    Language = employee.PreferredLanguage,
                    Employee = employee
                })
                .ToList();
        }

        // Один и тот же адрес из нескольких строк — оставляем первый (наименьший SortOrder).
        // Персональные письма исполнителям в дедупликацию не входят: у них разные тела,
        // и «схлопнуть» их означало бы потерять чьё-то задание.
        private static List<ResolvedRecipient> Deduplicate(List<ResolvedRecipient> resolved)
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var result = new List<ResolvedRecipient>();

            foreach (var recipient in resolved)
            {
                if (recipient.Employee is not null)
                {
                    result.Add(recipient);
                    continue;
                }

                if (!seen.Add(recipient.Address))
                    continue;

                result.Add(recipient);
            }

            return result;
        }
    }
}
