using ATTours.BusinessServices.Email;
using ATTours.BusinessServices.Html;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.PdfServices;
using ATTours.BusinessServices.Telegram;
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
    // Рендер и отправка писем заказов: шаблоны и получатели — из БД.
    //
    // DI (Scoped), а не `new` в контроллере: сервису нужен singleton IEmailSender, выбор
    // реализации которого зависит от конфига — это второе (после auth) осознанное
    // DI-исключение из «сервисы через new», ровно по обоснованию ADR 005. Резолвер и
    // info-сервисы внутри создаются через `new` — обычный паттерн проекта.
    //
    // Что здесь БОЛЬШЕ не зашито (редизайн 2026-08-23): получатель письма. Ни админского
    // ящика, ни «исполнителя из параметра», ни order.UserEmail — всё резолвится из
    // NotificationRecipient. Ноль активных получателей = письмо просто не уходит.
    public partial class OrderNotificationService : IOrderNotificationService
    {
        private readonly IEmailSender emailSender;
        private readonly ITelegramSender telegramSender;
        private readonly EmailSettings emailSettings;
        private readonly ILogger<OrderNotificationService> logger;
        private readonly NotificationRecipientResolver resolver;

        public OrderNotificationService(IEmailSender emailSender, ITelegramSender telegramSender,
            EmailSettings emailSettings, ILogger<OrderNotificationService> logger)
        {
            this.emailSender = emailSender;
            this.telegramSender = telegramSender;
            this.emailSettings = emailSettings;
            this.logger = logger;
            resolver = new NotificationRecipientResolver(emailSettings, logger);
        }

        // В момент создания брони исполнителей нет — строка-получатель «Исполнитель заказа»
        // на этом событии просто ни во что не резолвится.
        public Task SendOrderCreatedAsync(OrderInfoModel order, CancellationToken cancellationToken = default)
            => DispatchAsync(EmailActionKey.OrderCreated,
                new OrderNotificationContext { Order = order }, cancellationToken);

        // Исполнителей в контексте нет намеренно: отменяются заказы, до назначения которых
        // дело так и не дошло, а если исполнитель всё же был — событие всё равно адресовано
        // тому, кто следит за флоу заказов, и его состав получателей настраивается отдельно.
        public Task SendOrderAutoCancelledAsync(OrderInfoModel order, CancellationToken cancellationToken = default)
            => DispatchAsync(EmailActionKey.OrderAutoCancelled,
                new OrderNotificationContext { Order = order }, cancellationToken);

        public Task SendAssignmentAsync(OrderInfoModel order, IReadOnlyCollection<OrderEmployeeRecipient> assigned,
            CancellationToken cancellationToken = default)
            => DispatchAsync(EmailActionKey.OrderAssignEmployee,
                new OrderNotificationContext { Order = order, Employees = [.. assigned ?? []] }, cancellationToken);

        public Task SendUnassignmentAsync(OrderInfoModel order, IReadOnlyCollection<OrderEmployeeRecipient> unassigned,
            CancellationToken cancellationToken = default)
            => DispatchAsync(EmailActionKey.OrderUnassignEmployee,
                new OrderNotificationContext { Order = order, Employees = [.. unassigned ?? []] }, cancellationToken);

        public async Task SendOrderDocumentAsync(OrderInfoModel order, CancellationToken cancellationToken = default)
        {
            // Исполнители этого события — ВСЕ текущие исполнители заказа. Читаются из
            // сущностей, а не из OrderInfoModel: письму нужен PreferredLanguage, а его
            // в админский DTO строки заказа отдавать незачем.
            var employees = await LoadCurrentEmployeesAsync(order.Id, cancellationToken);

            await DispatchAsync(EmailActionKey.OrderSendToClient,
                new OrderNotificationContext { Order = order, Employees = employees }, cancellationToken);
        }

        // Единая точка события: оба канала подряд, в одном потоке запроса. Email первым как
        // основной, Telegram вторым как дублирующий. Оба транспорта глотают сбои провайдера
        // (swallow-and-log), поэтому недоступный канал не роняет уже сохранённую операцию —
        // выносить Telegram в фон отдельно от email осознанно не стали (ADR 031 §3).
        private async Task DispatchAsync(EmailActionKey key, OrderNotificationContext context,
            CancellationToken cancellationToken)
        {
            await DispatchEmailAsync(key, context, cancellationToken);
            await DispatchTelegramAsync(key, context, cancellationToken);
        }

        // Резолв получателей -> выбор языковых версий -> группировка -> отправка.
        private async Task DispatchEmailAsync(EmailActionKey key, OrderNotificationContext context,
            CancellationToken cancellationToken)
        {
            var recipients = await resolver.ResolveAsync(key, NotificationPlatform.Email, context, cancellationToken);

            // Ноль писем на выходе — нормальный результат (выключенный канал или пустой
            // список получателей), не ошибка операции.
            if (recipients.Count == 0)
                return;

            var template = await LoadTemplateAsync(key, cancellationToken);
            if (template is null)
                return;

            // Персональные письма исполнителям: своё тело (свои детали) и своё вложение,
            // поэтому в общую рассылку они не сливаются.
            foreach (var recipient in recipients.Where(x => x.Employee is not null))
                await SendPersonalAsync(template, key, context, recipient, cancellationToken);

            // Общие: одно письмо на языковую группу. Одно письмо не может быть одновременно
            // на двух языках, а «взять язык первого To» отправило бы англоязычному в копии
            // русский текст.
            var general = recipients.Where(x => x.Employee is null).ToList();

            foreach (var group in general.GroupBy(x => x.Language))
                await SendGroupAsync(template, key, context, group.Key, [.. group], cancellationToken);
        }

        private Task SendPersonalAsync(NotificationTemplate template, EmailActionKey key, OrderNotificationContext context,
            ResolvedRecipient recipient, CancellationToken cancellationToken)
        {
            var language = recipient.Language;
            var employee = recipient.Employee;

            var values = BuildValues(key, context, language, employee);

            var attachment = BuildAttachment(key, context, employee);

            var recipients = new EmailRecipients
            {
                To = [new EmailAddress { Email = recipient.Address, Name = recipient.Name }]
            };

            return SendAsync(template, key, recipients, language, values, attachment, cancellationToken);
        }

        private Task SendGroupAsync(NotificationTemplate template, EmailActionKey key, OrderNotificationContext context,
            LanguageCode language, List<ResolvedRecipient> group, CancellationToken cancellationToken)
        {
            var to = group.Where(x => x.Type == NotificationRecipientType.To).ToList();
            var cc = group.Where(x => x.Type == NotificationRecipientType.Cc).ToList();
            var bcc = group.Where(x => x.Type == NotificationRecipientType.Bcc).ToList();

            // Письмо без прямых получателей провайдер отверг бы целиком — поэтому копии
            // повышаются до To, а Bcc-only письмо адресуется собственному ящику отправителя.
            if (to.Count == 0 && cc.Count > 0)
            {
                to = cc;
                cc = [];
            }

            var recipients = new EmailRecipients
            {
                To = to.Count > 0
                    ? [.. to.Select(ToAddress)]
                    : [new EmailAddress { Email = emailSettings.FromEmail, Name = emailSettings.FromName }],
                Cc = [.. cc.Select(ToAddress)],
                Bcc = [.. bcc.Select(ToAddress)]
            };

            var values = BuildValues(key, context, language, employee: null);
            var attachment = BuildAttachment(key, context, employee: null);

            return SendAsync(template, key, recipients, language, values, attachment, cancellationToken);
        }

        private static EmailAddress ToAddress(ResolvedRecipient recipient)
            => new() { Email = recipient.Address, Name = recipient.Name };

        // null — каналу не назначен шаблон (Notification Templates, 2026-08-31: ссылка по
        // NotificationChannel.TemplateId, а не встроенная строка по ActionKey). «Тихо не
        // шлём», а не ошибка операции.
        private async Task<NotificationTemplate?> LoadTemplateAsync(EmailActionKey key, CancellationToken cancellationToken)
        {
            using var info = new NotificationSettingsInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var template = await info.GetTemplateAsync(key, NotificationPlatform.Email);

            if (template is null)
                logger.LogWarning("Email template for action {ActionKey} is missing; notification skipped.", key);

            return template;
        }

        // Текущие исполнители заказа для OrderSendToClient: сгруппированы по сотруднику,
        // LineIds — все его строки, роль — с первой строки группы.
        private static async Task<List<OrderEmployeeRecipient>> LoadCurrentEmployeesAsync(int orderId,
            CancellationToken cancellationToken)
        {
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var order = await info.GetByIdAsync(orderId, cancellationToken);

            if (order is null)
                return [];

            return [.. order.Lines
                .SelectMany(line => line.Employees)
                .Where(assignment => assignment.Employee is not null
                                     && !string.IsNullOrWhiteSpace(assignment.Employee.Email))
                .GroupBy(assignment => assignment.EmployeeId)
                .Select(group => new OrderEmployeeRecipient
                {
                    EmployeeId = group.Key,
                    Email = group.First().Employee.Email,
                    FullName = $"{group.First().Employee.FirstName} {group.First().Employee.LastName}".Trim(),
                    EmployeeRole = group.First().EmployeeRole,
                    PreferredLanguage = group.First().Employee.PreferredLanguage,
                    TelegramChatId = group.First().Employee.TelegramChatId,
                    LineIds = [.. group.Select(assignment => assignment.OrderLineId)]
                })];
        }

        // Состав токенов — по код-реестру события (EmailPlaceholders): токен, которого в точке
        // отправки нет, отрендерился бы пустой строкой и выглядел бы как баг.
        private static Dictionary<string, PlaceholderValue> BuildValues(EmailActionKey key,
            OrderNotificationContext context, LanguageCode language, OrderEmployeeRecipient? employee)
        {
            var order = context.Order;
            var culture = NotificationLabels.CultureFor(language);

            // Персональное письмо говорит об одном человеке, общее — обо всех исполнителях
            // этого срабатывания (пустой список -> пустая строка).
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

            var tokens = EmailPlaceholders.TokensFor(key);

            // Бронь с сайта — это чекаут корзины (ADR 025), строк может быть несколько, все
            // они уезжают в {{OrderLines}}. Плоские TourTitle/TourDate/GuestCount оставлены
            // привязанными к ПЕРВОЙ строке: их уже используют сохранённые в БД шаблоны, и
            // молча менять их смысл нельзя.
            var firstLine = order?.Lines.FirstOrDefault();

            foreach (var token in tokens)
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
                        values[token] = PlaceholderValue.Html(BuildOrderLinesHtml(order, language));
                        break;

                    case EmailPlaceholders.ClientContact:
                        values[token] = PlaceholderValue.Html(BuildClientContactHtml(order, language));
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
                        values[token] = PlaceholderValue.Html(BuildAssignmentDetailsHtml(order, addressed, language));
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

        // Вложение зависит от того, КОМУ уходит письмо: персональное задание исполнителю —
        // только его строки и только его карточка деталей; общее — документ заказа целиком.
        // Снятие исполнителя вложения не несёт: делать по нему уже нечего.
        private static EmailAttachment? BuildAttachment(EmailActionKey key, OrderNotificationContext context,
            OrderEmployeeRecipient? employee)
        {
            var order = context.Order;
            if (order is null)
                return null;

            byte[] document;
            string fileName;

            switch (key)
            {
                case EmailActionKey.OrderAssignEmployee:
                    var assignmentLineIds = employee is not null
                        ? employee.LineIds
                        : context.Employees.SelectMany(x => x.LineIds).Distinct().ToList();

                    if (assignmentLineIds.Count == 0)
                        return null;

                    document = OrderPdfService.GenerateAssignmentDocument(order, assignmentLineIds, employee?.EmployeeId);
                    fileName = $"assignment-{order.Number}.pdf";
                    break;

                case EmailActionKey.OrderSendToClient:
                    if (employee is not null)
                    {
                        if (employee.LineIds.Count == 0)
                            return null;

                        document = OrderPdfService.GenerateAssignmentDocument(order, employee.LineIds, employee.EmployeeId);
                        fileName = $"assignment-{order.Number}.pdf";
                        break;
                    }

                    document = OrderPdfService.GenerateOrderDocument(order);
                    fileName = $"order-{order.Number}.pdf";
                    break;

                default:
                    return null;
            }

            return document is null || document.Length == 0 ? null : new EmailAttachment(fileName, document);
        }

        private Task SendAsync(NotificationTemplate template, EmailActionKey key, EmailRecipients recipients,
            LanguageCode language, IReadOnlyDictionary<string, PlaceholderValue> values, EmailAttachment? attachment,
            CancellationToken cancellationToken)
        {
            // Фолбэк на RU — по каждому полю независимо: тема может быть переведена, тело
            // ещё нет. Warning'а при пустом EN нет: незаполненный перевод — легальное
            // состояние, а не ошибка конфигурации (в отличие от неизвестного плейсхолдера).
            var subjectSource = language == LanguageCode.English && !string.IsNullOrWhiteSpace(template.SubjectEn)
                ? template.SubjectEn
                : template.Subject;

            var bodySource = language == LanguageCode.English && !string.IsNullOrWhiteSpace(template.BodyHtmlEn)
                ? template.BodyHtmlEn
                : template.BodyHtml;

            // Тема — plaintext-заголовок письма, поэтому значения в неё идут без HTML-кодирования
            // (иначе «Иванов & Co» превратился бы в «Иванов &amp; Co»). Тело — HTML, значения
            // кодируются; исключение — токены, построенные самим бэкендом.
            var subject = Render(key, subjectSource, values, encodeText: false);
            var bodyHtml = Render(key, bodySource, values, encodeText: true);

            // В БД media-URL хранится относительным ("/uploads/..."), чтобы тот же контент
            // читали и админка, и письмо, и публичный сайт. Почтовый клиент базы не знает,
            // поэтому домен подставляется здесь, на отправке (ADR 026, решение 5).
            // subject не трогаем — это plaintext.
            var mediaBaseUrl = emailSettings.PublicMediaBaseUrl;

            if (!string.IsNullOrEmpty(mediaBaseUrl))
                bodyHtml = MediaUrlAbsolutizer.Absolutize(bodyHtml, mediaBaseUrl);
            else if (MediaUrlAbsolutizer.ContainsRelativeUrl(bodyHtml))
                logger.LogWarning(
                    "Email template {ActionKey} contains relative URLs, but Email:PublicMediaBaseUrl is not configured " +
                    "and could not be derived from Email:VerifyUrlBase; images/links will be broken in the sent email.",
                    key);

            return emailSender.SendTransactionalAsync(recipients, subject, bodyHtml, attachment, cancellationToken);
        }

        // Неизвестный/устаревший токен -> пустая строка + warning: литерал {{Foo}} в письме
        // клиенту выглядит как баг, а warning показывает, что шаблон пора поправить. `key` —
        // только для лога (какое событие рендерило); общий метод, используется и Email-, и
        // Telegram-веткой (см. OrderNotificationService.Telegram.cs) — у обеих один и тот же
        // формат {{Token}} и одна и та же логика подстановки, разница только в том, КАКИЕ
        // значения (Telegram-safe vs HTML) собирает вызывающая сторона.
        private string Render(EmailActionKey key, string source,
            IReadOnlyDictionary<string, PlaceholderValue> values, bool encodeText)
        {
            if (string.IsNullOrEmpty(source))
                return string.Empty;

            return PlaceholderRegex().Replace(source, match =>
            {
                var token = match.Groups["token"].Value;

                if (!values.TryGetValue(token, out var value))
                {
                    logger.LogWarning("Unknown placeholder '{Token}' in notification template for {ActionKey}; rendered as empty.",
                        token, key);
                    return string.Empty;
                }

                if (value.IsRawHtml)
                    return value.Value;

                return encodeText ? WebUtility.HtmlEncode(value.Value) : value.Value;
            });
        }

        // Карточки «деталей для выполнения» по каждому адресату письма и каждой его строке.
        // Незаполненное поле НЕ выводится вовсе (правило Давида 2026-08-23) — заглушек
        // «не указано»/«не указан» здесь больше нет, как и в OrderPdfService.
        //
        // Подписи берутся по языку письма: разметку строит бэкенд, значит и её подписи
        // обязаны быть на языке получателя.
        private static string BuildAssignmentDetailsHtml(OrderInfoModel? order,
            IReadOnlyCollection<OrderEmployeeRecipient> employees, LanguageCode language)
        {
            if (order is null || employees is null || employees.Count == 0)
                return string.Empty;

            var builder = new StringBuilder();

            foreach (var employee in employees)
            {
                foreach (var line in order.Lines.Where(line => employee.LineIds.Contains(line.Id)))
                {
                    // Назначения может уже не быть (снятие) — тогда печатается только шапка
                    // строки и роль из снапшота результата операции.
                    var assignment = line.Employees.FirstOrDefault(x => x.EmployeeId == employee.EmployeeId);
                    var role = assignment?.EmployeeRole ?? employee.EmployeeRole;

                    builder.Append("<p>")
                           .Append(NotificationLabels.For(NotificationLabels.Tour, language)).Append(": ")
                           .Append(WebUtility.HtmlEncode(line.TourTitle)).Append("<br>")
                           .Append(NotificationLabels.For(NotificationLabels.Date, language)).Append(": ")
                           .Append(NotificationLabels.FormatDate(line.TourDate, language))
                           .Append(", ").Append(NotificationLabels.For(NotificationLabels.Guests, language))
                           .Append(": ").Append(line.GuestCount).Append("<br>")
                           .Append(NotificationLabels.For(NotificationLabels.Role, language)).Append(": ")
                           .Append(WebUtility.HtmlEncode(role.ToLabel(language)));

                    AppendOptional(builder, NotificationLabels.Pickup, assignment?.PickupDetails, language);
                    AppendOptional(builder, NotificationLabels.Navigator, assignment?.NavigatorLink, language);
                    AppendOptional(builder, NotificationLabels.Comment, ResolveComment(assignment, language), language);

                    builder.Append("</p>");
                }
            }

            return builder.ToString();
        }

        // EN-письмо получает CommentEn, если он заполнен, иначе русский комментарий: пустое
        // поле лучше не показывать вовсе, но потерять уже введённый админом текст — хуже.
        private static string? ResolveComment(OrderLineEmployeeInfoModel? assignment, LanguageCode language)
        {
            if (assignment is null)
                return null;

            if (language == LanguageCode.English && !string.IsNullOrWhiteSpace(assignment.CommentEn))
                return assignment.CommentEn;

            return assignment.Comment;
        }

        private static void AppendOptional(StringBuilder builder, string labelToken, string? value, LanguageCode language)
        {
            if (string.IsNullOrWhiteSpace(value))
                return;

            builder.Append("<br>")
                   .Append(NotificationLabels.For(labelToken, language)).Append(": ")
                   .Append(WebUtility.HtmlEncode(value));
        }

        // Все позиции заказа списком для письма о новой брони (ADR 025). Тот же приём, что у
        // BuildAssignmentDetailsHtml: разметку строит бэкенд, значения строк HTML-кодируются.
        // Полей меньше, чем в назначении: место встречи/навигатор в момент брони ещё пустые.
        private static string BuildOrderLinesHtml(OrderInfoModel? order, LanguageCode language)
        {
            if (order is null)
                return string.Empty;

            var builder = new StringBuilder();

            foreach (var line in order.Lines)
            {
                builder.Append("<p>")
                       .Append(NotificationLabels.For(NotificationLabels.Tour, language)).Append(": ")
                       .Append(WebUtility.HtmlEncode(line.TourTitle)).Append("<br>")
                       .Append(NotificationLabels.For(NotificationLabels.Date, language)).Append(": ")
                       .Append(NotificationLabels.FormatDate(line.TourDate, language))
                       .Append(", ").Append(NotificationLabels.For(NotificationLabels.Guests, language))
                       .Append(": ").Append(line.GuestCount)
                       .Append("</p>");
            }

            return builder.ToString();
        }

        /// <summary>
        /// Блок «с кем связаться по этому заказу» — значение токена {{ClientContact}}.
        /// </summary>
        /// <remarks>
        /// Ради этого блока вся затея и делалась (ADR 032): клиент регистрируется с одним номером,
        /// приезжает в Армению с другим, и менеджер не должен гадать, куда звонить. Поэтому здесь
        /// выводится не телефон аккаунта, а именно контакты ЗАКАЗА.
        ///
        /// Порядок задаёт сервер (основной первым) — сортировки тут нет намеренно: тот же порядок
        /// человек видел в форме заказа и увидит в админке, и третий вариант порядка в письме
        /// читался бы как другие данные.
        ///
        /// Фамилия НЕОБЯЗАТЕЛЬНА (решение Давида, 2026-08-29), поэтому имя собирается отбором
        /// непустых: иначе в письме оказалось бы «Ани&#160;&#160;·» с дырой вместо фамилии.
        ///
        /// Заказы, созданные до этого батча, контактов не имеют и не бэкфиллились — у них блок
        /// пустой. Пустая строка здесь честнее выдуманного «не указано»: в шаблоне админ сам
        /// решает, что писать вокруг токена.
        /// </remarks>
        private static string BuildClientContactHtml(OrderInfoModel? order, LanguageCode language)
        {
            if (order is null || order.Contacts.Count == 0)
                return string.Empty;

            var builder = new StringBuilder();

            foreach (var contact in order.Contacts)
            {
                var name = string.Join(' ', new[] { contact.FirstName, contact.LastName }
                    .Where(part => !string.IsNullOrWhiteSpace(part)));

                builder.Append("<p>")
                       .Append(WebUtility.HtmlEncode(name));

                if (contact.IsPrimary)
                    builder.Append(" (")
                           .Append(NotificationLabels.For(NotificationLabels.PrimaryContact, language))
                           .Append(')');

                builder.Append("<br>")
                       .Append(WebUtility.HtmlEncode(contact.Type.ToLabel(language))).Append(": ")
                       .Append(WebUtility.HtmlEncode(contact.Value))
                       .Append("</p>");
            }

            return builder.ToString();
        }

        [GeneratedRegex(@"\{\{(?<token>[A-Za-z0-9_]+)\}\}", RegexOptions.CultureInvariant)]
        private static partial Regex PlaceholderRegex();

        // Значение плейсхолдера: либо текст (HTML-кодируется при рендере тела), либо готовый
        // безопасный HTML, собранный самим бэкендом (AssignmentDetails/OrderLines).
        private readonly struct PlaceholderValue
        {
            private PlaceholderValue(string value, bool isRawHtml)
            {
                Value = value;
                IsRawHtml = isRawHtml;
            }

            public string Value { get; }

            public bool IsRawHtml { get; }

            // null-значение (например, у заказа не оказалось строк) рендерится пустой строкой,
            // а не литералом "null".
            public static PlaceholderValue Text(string? value) => new(value ?? string.Empty, false);

            public static PlaceholderValue Html(string value) => new(value ?? string.Empty, true);
        }
    }
}
