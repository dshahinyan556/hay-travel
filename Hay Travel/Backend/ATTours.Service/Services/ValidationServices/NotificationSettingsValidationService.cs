using ATTours.Common.Constants;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация раздела «Настройки уведомлений» перед сохранением события целиком.
    // Не EntityValidationBase<T>: проверять надо не набор однотипных сущностей, а входную
    // форму (событие → платформы → получатели), причём часть правил требует похода в БД
    // (существование пользователя) — базовый контракт этого не предполагает.
    //
    // Валидация НЕ запрещает событие с нулём активных получателей: это разрешённое
    // состояние — письмо просто не уходит.
    internal class NotificationSettingsValidationService
    {
        // Потолок для nvarchar(max): без него вставленный из Word документ на мегабайт
        // сохранился бы молча. 64 КБ разметки — это сотни абзацев и десятки картинок-ссылок,
        // и при этом на порядок ниже порога клиппинга Gmail (~102 КБ) (ADR 026, решение 6).
        public const int MaxBodyHtmlLength = 65_536;

        private readonly NotificationEventUpdateModel? model;
        private readonly IApplicationDbContext context;
        private readonly CancellationToken cancellationToken;

        public NotificationSettingsValidationService(NotificationEventUpdateModel? model,
            IApplicationDbContext context, CancellationToken cancellationToken = default)
        {
            this.model = model;
            this.context = context;
            this.cancellationToken = cancellationToken;
        }

        public async Task ValidateAsync()
        {
            if (model is null)
                throw new ErrorModelException(GlobalErrorCode.NotificationRecipientInvalid, HttpStatusCode.BadRequest,
                    "Notification event payload is empty.");

            if (!EmailPlaceholders.IsKnown(model.EventKey))
                throw new ErrorModelException(GlobalErrorCode.EmailTemplateInvalid, HttpStatusCode.BadRequest,
                    $"Email action key '{(int)model.EventKey}' is unknown.");

            foreach (var platform in model.Platforms ?? [])
                await ValidatePlatformAsync(model.EventKey, platform);
        }

        private async Task ValidatePlatformAsync(EmailActionKey eventKey, NotificationPlatformUpdateModel platform)
        {
            if (!Enum.IsDefined(platform.Platform))
                throw Invalid($"Notification platform '{(int)platform.Platform}' is unknown.");

            if (platform.IsEnabled)
                await ValidateTemplateReferenceAsync(eventKey, platform);

            var recipients = platform.Recipients ?? [];

            foreach (var recipient in recipients)
                await ValidateRecipientAsync(platform.Platform, recipient);

            EnsureNoDuplicates(recipients);
        }

        // Раньше здесь проверялась встроенная Subject/BodyHtml (только у Email — у Telegram
        // шаблона не было вовсе). Теперь у обеих платформ — ссылка на шаблон из открытой
        // библиотеки Notification Templates: обязательна, когда платформа включена (пустой
        // TemplateId у включённого канала означал бы «письмо уходит пустым», это баг, а не
        // легальное состояние). Существование и корректность содержимого самого шаблона —
        // забота NotificationTemplateValidationService на СОХРАНЕНИИ шаблона, здесь только
        // проверяем ссылку.
        private async Task ValidateTemplateReferenceAsync(EmailActionKey eventKey, NotificationPlatformUpdateModel platform)
        {
            if (platform.TemplateId is null)
                throw new ErrorModelException(GlobalErrorCode.NotificationTemplateInvalid, HttpStatusCode.BadRequest,
                    $"Notification channel '{eventKey}'/{platform.Platform} is enabled but has no template assigned.");

            var template = await context.Set<NotificationTemplate>()
                                        .AsNoTracking()
                                        .SingleOrDefaultAsync(x => x.Id == platform.TemplateId, cancellationToken);

            if (template is null)
                throw new ErrorModelException(GlobalErrorCode.NotificationTemplateInvalid, HttpStatusCode.BadRequest,
                    $"Template {platform.TemplateId} not found.");

            if (template.Channel != platform.Platform)
                throw new ErrorModelException(GlobalErrorCode.NotificationTemplateInvalid, HttpStatusCode.BadRequest,
                    $"Template {platform.TemplateId} is a {template.Channel} template and cannot be used for {platform.Platform}.");
        }

        private async Task ValidateRecipientAsync(NotificationPlatform platform, NotificationRecipientUpdateModel recipient)
        {
            if (!Enum.IsDefined(recipient.SourceType))
                throw Invalid($"Recipient source '{(int)recipient.SourceType}' is unknown.");

            if (platform == NotificationPlatform.Email)
            {
                // To/Cc/Bcc — обязательная характеристика адреса в письме: без неё непонятно,
                // в какой список его класть.
                if (recipient.Type is null || !Enum.IsDefined(recipient.Type.Value))
                    throw Invalid("Email recipient must have a valid To/Cc/Bcc type.");
            }
            else
            {
                // У Telegram копий/скрытых копий не бывает, а CustomEmail/AdminMailbox —
                // email-специфичные источники адреса.
                if (recipient.Type is not null)
                    throw Invalid("Telegram recipient must not have a To/Cc/Bcc type.");

                if (recipient.SourceType is not (NotificationRecipientSource.User or NotificationRecipientSource.OrderLinked))
                    throw Invalid("Telegram recipient source must be a system user or an order-linked role.");
            }

            switch (recipient.SourceType)
            {
                case NotificationRecipientSource.User:
                    if (recipient.UserId is null)
                        throw Invalid("Recipient of type 'User' must reference a user.");

                    var userExists = await context.Set<User>()
                                                  .AsNoTracking()
                                                  .AnyAsync(user => user.Id == recipient.UserId && !user.IsDeleted,
                                                      cancellationToken);

                    if (!userExists)
                        throw Invalid($"User with id {recipient.UserId} not found.");
                    break;

                case NotificationRecipientSource.OrderLinked:
                    if (recipient.OrderLinkedRole is null || !Enum.IsDefined(recipient.OrderLinkedRole.Value))
                        throw Invalid("Order-linked recipient must have a valid role.");
                    break;

                case NotificationRecipientSource.CustomEmail:
                    // Полноценного RFC-валидатора в проекте нет и заводить его здесь незачем:
                    // адрес всё равно проверяет почтовый провайдер на отправке.
                    if (string.IsNullOrWhiteSpace(recipient.CustomEmail) || !recipient.CustomEmail.Contains('@'))
                        throw Invalid("Custom email recipient must have a valid address.");
                    break;

                case NotificationRecipientSource.AdminMailbox:
                    // Адрес берётся из конфигурации, остальные поля игнорируются (обнуляются
                    // при сохранении) — проверять здесь нечего.
                    break;
            }
        }

        // Два одинаковых получателя с одинаковым Type — почти наверняка ошибка ввода:
        // письмо от этого не задвоится (резолвер дедуплицирует), но грид врёт админу.
        private static void EnsureNoDuplicates(List<NotificationRecipientUpdateModel> recipients)
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var recipient in recipients)
            {
                var sourceKey = recipient.SourceType switch
                {
                    NotificationRecipientSource.User => recipient.UserId?.ToString() ?? string.Empty,
                    NotificationRecipientSource.OrderLinked => ((int?)recipient.OrderLinkedRole)?.ToString() ?? string.Empty,
                    NotificationRecipientSource.CustomEmail => recipient.CustomEmail?.Trim().ToLowerInvariant() ?? string.Empty,
                    _ => string.Empty
                };

                var key = $"{(int)recipient.SourceType}|{sourceKey}|{(int?)recipient.Type}";

                if (!seen.Add(key))
                    throw Invalid("The same recipient is listed more than once for this platform.");
            }
        }

        private static ErrorModelException Invalid(string message)
            => new(GlobalErrorCode.NotificationRecipientInvalid, HttpStatusCode.BadRequest, message);
    }
}
