using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.Constants;
using ATTours.Common.DTO.Info;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using ATTours.Common.Settings;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace ATTours.BusinessServices.Notifications
{
    // Telegram-ветка отправки уведомлений заказа (ADR 031 §2, рефакторинг 2026-08-31).
    // Отдельный partial-файл того же класса: поля и ctor — в OrderNotificationService.cs.
    //
    // ДО 2026-08-31 у Telegram шаблона не было вовсе: текст собирал код (см. историю файла),
    // потому что admin-HTML с таблицами/инлайн-стилями Telegram отрисовал бы сломанным —
    // sendMessage поддерживает лишь узкий whitelist тегов (b/strong/i/em/u/s/code/pre/a).
    // Теперь у Telegram ЕСТЬ шаблон (Channel.Telegram в NotificationTemplate) — он снимает
    // исходную причину отказа: HtmlContentProfile.TelegramBody санитизирует ИМЕННО под этот
    // whitelist, и admin-разметка физически не может выйти за его пределы. Персонализация
    // (детали по каждому исполнителю) и обрезка по лимиту сообщения остаются кодовыми —
    // они превращены в TELEGRAM-SAFE ТОКЕНЫ (AssignmentDetails/OrderLines/ClientContact,
    // те же имена, что у Email — общий Render/PlaceholderRegex одинаково подставляет и туда,
    // и туда, разница только в том, какие значения собирает эта ветка).
    public partial class OrderNotificationService
    {
        // Жёсткий лимит sendMessage — 4096 символов; берём с запасом. Заказ на 10 строк
        // с длинными комментариями реально может его пробить, а Bot API ответил бы 400 и
        // уведомление потерялось бы целиком. Обрезка теперь применяется К ГОТОВОМУ телу
        // ПОСЛЕ подстановки токенов в шаблон (длина зависит от авторского текста админа
        // вокруг токенов, не только от данных).
        private const int TelegramMessageMaxLength = 3900;

        private async Task DispatchTelegramAsync(EmailActionKey key, OrderNotificationContext context,
            CancellationToken cancellationToken)
        {
            // Канал-гейт (IsChannelEnabledAsync) уже внутри резолвера: выключенный
            // Telegram-канал — тихий no-op, как и у email.
            var recipients = await resolver.ResolveAsync(key, NotificationPlatform.Telegram, context, cancellationToken);

            if (recipients.Count == 0)
                return;

            var template = await LoadTelegramTemplateAsync(key, cancellationToken);
            if (template is null)
                return;

            foreach (var recipient in recipients)
            {
                // Строка-получатель настроена, но человек не прошёл /start: молча пропускать
                // нельзя — со стороны админа это выглядело бы как «уведомление пропало».
                if (recipient.TelegramChatId is null)
                {
                    logger.LogInformation("Recipient «{Name}» is configured for Telegram notifications of {ActionKey}, " +
                        "but has not linked a Telegram account; skipped.", recipient.Name, key);
                    continue;
                }

                var bodySource = recipient.Language == LanguageCode.English && !string.IsNullOrWhiteSpace(template.BodyHtmlEn)
                    ? template.BodyHtmlEn
                    : template.BodyHtml;

                var values = BuildTelegramValues(key, context, recipient.Language, recipient.Employee);
                var text = Truncate(Render(key, ParagraphsToNewlines(bodySource), values, encodeText: true));

                await telegramSender.SendMessageAsync(recipient.TelegramChatId.Value, text, cancellationToken);
            }
        }

        // null — каналу не назначен шаблон. «Тихо не шлём», а не ошибка операции (то же
        // поведение, что у отсутствующего Email-шаблона).
        private async Task<NotificationTemplate?> LoadTelegramTemplateAsync(EmailActionKey key,
            CancellationToken cancellationToken)
        {
            using var info = new NotificationSettingsInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var template = await info.GetTemplateAsync(key, NotificationPlatform.Telegram);

            if (template is null)
                logger.LogWarning("Telegram template for action {ActionKey} is missing; notification skipped.", key);

            return template;
        }

        // "p"/"br" — единственные теги, разрешённые в HtmlContentPolicy.TelegramEntry ИСКЛЮЧИТЕЛЬНО
        // ради хранения (TipTap безусловно оборачивает каждый абзац в <p>; без них санитайзер
        // вырезал бы тело шаблона целиком на каждом сохранении — см. доккомент TelegramEntry).
        // Telegram Bot API их не понимает вообще ни в каком виде, поэтому непосредственно перед
        // отправкой они конвертируются в переносы строк: закрывающий-открывающий стык абзацев
        // ("</p><p>") — в пустую строку между ними, одиночные — в перенос, <br> — в перенос.
        private static readonly Regex ParagraphBoundaryRegex = ParagraphBoundaryRegexGenerated();
        private static readonly Regex ParagraphTagRegex = ParagraphTagRegexGenerated();
        private static readonly Regex BreakTagRegex = BreakTagRegexGenerated();

        private static string ParagraphsToNewlines(string html)
        {
            if (string.IsNullOrEmpty(html))
                return string.Empty;

            var result = ParagraphBoundaryRegex.Replace(html, "\n\n");
            result = BreakTagRegex.Replace(result, "\n");
            result = ParagraphTagRegex.Replace(result, string.Empty);

            return result.Trim('\n');
        }

        [GeneratedRegex(@"</p>\s*<p>", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
        private static partial Regex ParagraphBoundaryRegexGenerated();

        [GeneratedRegex(@"</?p>", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
        private static partial Regex ParagraphTagRegexGenerated();

        [GeneratedRegex(@"<br\s*/?>", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
        private static partial Regex BreakTagRegexGenerated();

        // Режем по последнему переводу строки в пределах лимита, а не по символу: обрыв
        // посреди HTML-сущности («&am») развалил бы parse_mode и Telegram отверг бы всё
        // сообщение целиком.
        private static string Truncate(string text)
        {
            if (text.Length <= TelegramMessageMaxLength)
                return text;

            var cut = text.LastIndexOf('\n', TelegramMessageMaxLength - 1);

            return cut > 0 ? text[..cut] : text[..TelegramMessageMaxLength];
        }

        // Telegram-зеркало OrderNotificationService.BuildValues: те же имена токенов
        // (общий Render их не различает), но AssignmentDetails/OrderLines/ClientContact —
        // Telegram-safe текст (\n + <b>), а не HTML-таблицы/абзацы.
        private static Dictionary<string, PlaceholderValue> BuildTelegramValues(EmailActionKey key,
            OrderNotificationContext context, LanguageCode language, OrderEmployeeRecipient? employee)
        {
            var order = context.Order;
            var culture = NotificationLabels.CultureFor(language);

            var addressed = employee is null ? context.Employees : [employee];

            var employeeName = employee is not null
                ? employee.FullName
                : string.Join(", ", context.Employees.Select(x => x.FullName));

            var employeeRole = employee is not null
                ? employee.EmployeeRole.ToLabel(language)
                : string.Join(", ", context.Employees.Select(x => $"{x.FullName} ({x.EmployeeRole.ToLabel(language)})"));

            var values = new Dictionary<string, PlaceholderValue>(StringComparer.Ordinal)
            {
                [EmailPlaceholders.OrderNumber] = PlaceholderValue.Text(order?.Number)
            };

            var firstLine = order?.Lines.FirstOrDefault();

            foreach (var token in EmailPlaceholders.TokensFor(key))
            {
                switch (token)
                {
                    case EmailPlaceholders.TourTitle:
                        values[token] = PlaceholderValue.Text(firstLine?.TourTitle);
                        break;
                    case EmailPlaceholders.TourDate:
                        values[token] = PlaceholderValue.Text(firstLine is null
                            ? null
                            : NotificationLabels.FormatDate(firstLine.TourDate, language));
                        break;
                    case EmailPlaceholders.GuestCount:
                        values[token] = PlaceholderValue.Text(firstLine?.GuestCount.ToString(culture));
                        break;
                    case EmailPlaceholders.OrderLines:
                        values[token] = PlaceholderValue.Html(BuildOrderLinesText(order, language));
                        break;
                    case EmailPlaceholders.ClientContact:
                        values[token] = PlaceholderValue.Html(BuildClientContactText(order, language));
                        break;
                    case EmailPlaceholders.ClientName:
                        values[token] = PlaceholderValue.Text(order?.UserFullName);
                        break;
                    case EmailPlaceholders.ClientEmail:
                        values[token] = PlaceholderValue.Text(order?.UserEmail);
                        break;
                    case EmailPlaceholders.EmployeeName:
                        values[token] = PlaceholderValue.Text(employeeName);
                        break;
                    case EmailPlaceholders.EmployeeRole:
                        values[token] = PlaceholderValue.Text(employeeRole);
                        break;
                    case EmailPlaceholders.AssignmentDetails:
                        values[token] = PlaceholderValue.Html(BuildAssignmentDetailsText(order, addressed, language));
                        break;
                    case EmailPlaceholders.OrderCreatedDate:
                        values[token] = PlaceholderValue.Text(order is null
                            ? null
                            : NotificationLabels.FormatDate(DateOnly.FromDateTime(order.CreatedAtUtc), language));
                        break;
                    case EmailPlaceholders.OrderCurrency:
                        values[token] = PlaceholderValue.Text(order?.Currency);
                        break;
                    case EmailPlaceholders.EventTitle:
                        values[token] = PlaceholderValue.Text(NotificationLabels.EventTitle(key, language));
                        break;
                }
            }

            return values;
        }

        // Персональный блок: только строки этого исполнителя, с деталями выполнения.
        // Незаполненное поле не выводится вовсе — то же правило, что в письме и в PDF.
        // Telegram HTML не поддерживает <p>/<br> — переносы строк собираются буквальным '\n'.
        private static string BuildAssignmentDetailsText(OrderInfoModel? order,
            IReadOnlyCollection<OrderEmployeeRecipient> employees, LanguageCode language)
        {
            if (order is null || employees is null || employees.Count == 0)
                return string.Empty;

            var builder = new StringBuilder();

            foreach (var employee in employees)
            {
                foreach (var line in order.Lines.Where(line => employee.LineIds.Contains(line.Id)))
                {
                    var assignment = line.Employees.FirstOrDefault(x => x.EmployeeId == employee.EmployeeId);
                    var role = assignment?.EmployeeRole ?? employee.EmployeeRole;

                    builder.Append('\n');
                    AppendTourAndDate(builder, line, language);
                    AppendLine(builder, NotificationLabels.For(NotificationLabels.Role, language), role.ToLabel(language));
                    AppendLine(builder, NotificationLabels.For(NotificationLabels.Pickup, language), assignment?.PickupDetails);
                    AppendLine(builder, NotificationLabels.For(NotificationLabels.Navigator, language), assignment?.NavigatorLink);
                    AppendLine(builder, NotificationLabels.For(NotificationLabels.Comment, language),
                        ResolveComment(assignment, language));
                }
            }

            return builder.ToString();
        }

        private static string BuildOrderLinesText(OrderInfoModel? order, LanguageCode language)
        {
            if (order is null)
                return string.Empty;

            var builder = new StringBuilder();

            foreach (var line in order.Lines)
            {
                builder.Append('\n');
                AppendTourAndDate(builder, line, language);
            }

            return builder.ToString();
        }

        private static void AppendTourAndDate(StringBuilder builder, OrderLineInfoModel line, LanguageCode language)
        {
            AppendLine(builder, NotificationLabels.For(NotificationLabels.Tour, language), line.TourTitle);

            builder.Append('\n')
                   .Append(NotificationLabels.For(NotificationLabels.Date, language)).Append(": ")
                   .Append(NotificationLabels.FormatDate(line.TourDate, language))
                   .Append(", ").Append(NotificationLabels.For(NotificationLabels.Guests, language))
                   .Append(": ").Append(line.GuestCount.ToString(NotificationLabels.CultureFor(language)));
        }

        // Plaintext-зеркало HTML-блока {{ClientContact}} из письма. Формат — «Имя (основной)»
        // и следом «Телефон: +374…», по строке на контакт: в Telegram нет вёрстки, и связка
        // «кто — как» должна читаться с телефона одним взглядом.
        private static string BuildClientContactText(OrderInfoModel? order, LanguageCode language)
        {
            if (order is null || order.Contacts.Count == 0)
                return string.Empty;

            var builder = new StringBuilder();

            foreach (var contact in order.Contacts)
            {
                var name = string.Join(' ', new[] { contact.FirstName, contact.LastName }
                    .Where(part => !string.IsNullOrWhiteSpace(part)));

                if (contact.IsPrimary)
                    name = $"{name} ({NotificationLabels.For(NotificationLabels.PrimaryContact, language)})";

                builder.Append('\n').Append(WebUtility.HtmlEncode(name));
                AppendLine(builder, contact.Type.ToLabel(language), contact.Value);
            }

            return builder.ToString();
        }

        private static void AppendLine(StringBuilder builder, string label, string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return;

            builder.Append('\n')
                   .Append(label).Append(": ")
                   .Append(WebUtility.HtmlEncode(value));
        }
    }
}
