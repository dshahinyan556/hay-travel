using ATTours.Common.DTO.Info;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text;

namespace ATTours.BusinessServices.Notifications
{
    // Telegram-ветка отправки уведомлений заказа (ADR 031 §2). Отдельный partial-файл того
    // же класса: поля и ctor — в OrderNotificationService.cs, здесь только сборка текста и
    // доставка.
    //
    // Шаблона у Telegram нет и не будет (NotificationSettingsInfo отдаёт Template = null для
    // этой платформы): admin-HTML письма с таблицами и инлайн-стилями Telegram отрисовал бы
    // сломанным — sendMessage поддерживает лишь узкий whitelist тегов. Поэтому текст
    // собирается кодом из того же события и того же контекста, что и письмо.
    public partial class OrderNotificationService
    {
        // Жёсткий лимит sendMessage — 4096 символов; берём с запасом. Заказ на 10 строк
        // с длинными комментариями реально может его пробить, а Bot API ответил бы 400 и
        // уведомление потерялось бы целиком.
        private const int TelegramMessageMaxLength = 3900;

        private async Task DispatchTelegramAsync(EmailActionKey key, OrderNotificationContext context,
            CancellationToken cancellationToken)
        {
            // Канал-гейт (IsChannelEnabledAsync) уже внутри резолвера: выключенный
            // Telegram-канал — тихий no-op, как и у email.
            var recipients = await resolver.ResolveAsync(key, NotificationPlatform.Telegram, context, cancellationToken);

            if (recipients.Count == 0)
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

                var text = BuildTelegramText(key, context, recipient.Language, recipient.Employee);

                await telegramSender.SendMessageAsync(recipient.TelegramChatId.Value, text, cancellationToken);
            }
        }

        // Короткий plaintext c минимальной разметкой Telegram (<b> для заголовка). Значения
        // HTML-кодируются: имя тура вида «Тур "Гарни & Гегард"» иначе развалил бы parse_mode.
        //
        // employee != null — персональное уведомление: только его строки и его роль
        // (plaintext-аналог BuildAssignmentDetailsHtml). employee == null — общий обзор
        // заказа (plaintext-аналог BuildOrderLinesHtml).
        private static string BuildTelegramText(EmailActionKey key, OrderNotificationContext context,
            LanguageCode language, OrderEmployeeRecipient? employee)
        {
            var order = context?.Order;
            var builder = new StringBuilder();

            var title = NotificationLabels.EventTitle(key, language);
            if (!string.IsNullOrEmpty(title))
                builder.Append("<b>").Append(WebUtility.HtmlEncode(title)).Append("</b>");

            if (order is null)
                return builder.ToString();

            AppendLine(builder, NotificationLabels.For(NotificationLabels.Order, language), order.Number);

            if (employee is not null)
                AppendEmployeeLines(builder, order, employee, language);
            else
                AppendOrderLines(builder, order, language);

            return Truncate(builder.ToString());
        }

        // Режем по последнему переводу строки в пределах лимита, а не по символу: обрыв
        // посреди HTML-сущности («&am») развалил бы parse_mode и Telegram отверг бы всё
        // сообщение. Заголовок с <b>…</b> в лимит помещается всегда, незакрытых тегов не
        // остаётся.
        private static string Truncate(string text)
        {
            if (text.Length <= TelegramMessageMaxLength)
                return text;

            var cut = text.LastIndexOf('\n', TelegramMessageMaxLength - 1);

            return cut > 0 ? text[..cut] : text[..TelegramMessageMaxLength];
        }

        // Персональный блок: только строки этого исполнителя, с деталями выполнения.
        // Незаполненное поле не выводится вовсе — то же правило, что в письме и в PDF.
        private static void AppendEmployeeLines(StringBuilder builder, OrderInfoModel order,
            OrderEmployeeRecipient employee, LanguageCode language)
        {
            foreach (var line in order.Lines.Where(line => employee.LineIds.Contains(line.Id)))
            {
                // Назначения может уже не быть (снятие) — тогда печатается шапка строки
                // и роль из снапшота результата операции.
                var assignment = line.Employees.FirstOrDefault(x => x.EmployeeId == employee.EmployeeId);
                var role = assignment?.EmployeeRole ?? employee.EmployeeRole;

                builder.Append('\n');
                AppendTourAndDate(builder, line, language);
                AppendLine(builder, NotificationLabels.For(NotificationLabels.Role, language),
                    role.ToLabel(language));
                AppendLine(builder, NotificationLabels.For(NotificationLabels.Pickup, language),
                    assignment?.PickupDetails);
                AppendLine(builder, NotificationLabels.For(NotificationLabels.Navigator, language),
                    assignment?.NavigatorLink);
                AppendLine(builder, NotificationLabels.For(NotificationLabels.Comment, language),
                    ResolveComment(assignment, language));
            }
        }

        private static void AppendOrderLines(StringBuilder builder, OrderInfoModel order, LanguageCode language)
        {
            foreach (var line in order.Lines)
            {
                builder.Append('\n');
                AppendTourAndDate(builder, line, language);
            }
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
