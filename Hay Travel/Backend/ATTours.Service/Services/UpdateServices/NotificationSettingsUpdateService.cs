using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Html;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Сохранение одного события целиком (declarative sync, редизайн 2026-08-23): рубильники
    // платформ + шаблон письма + ПОЛНЫЙ набор строк-получателей одним запросом и одним
    // SaveChanges. Частичных POST/PATCH/DELETE на строку нет: экран — редактируемый грид с
    // одной кнопкой «Сохранить» (тот же приём, что у UsersController.PutPermissionOverrides).
    //
    // Сюда же переехали upsert шаблона и его санитизация из удалённого
    // EmailTemplateUpdateService: отдельного эндпоинта правки шаблона больше нет.
    public class NotificationSettingsUpdateService : RepositoryCoreBase<NotificationRecipient, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public NotificationSettingsUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task SaveEventAsync(NotificationEventUpdateModel? model)
        {
            // Дешёвая предпроверка сырого входа ДО санитизации: разбирать многомегабайтную
            // строку AngleSharp'ом только чтобы потом отвергнуть её по длине — незачем.
            // Запас 4x покрывает разметку, которую санитайзер вырежет.
            foreach (var platform in model?.Platforms ?? [])
            {
                EnsureRawBodyIsSane(platform.BodyHtml);
                EnsureRawBodyIsSane(platform.BodyHtmlEn);
            }

            // Пустое тело запроса отбивает валидация — дальше model заведомо не null.
            await new NotificationSettingsValidationService(model, Context, cancellationToken).ValidateAsync();

            foreach (var platform in model!.Platforms ?? [])
            {
                await UpsertChannelAsync(model.EventKey, platform);

                if (platform.Platform == NotificationPlatform.Email)
                    await UpsertTemplateAsync(model.EventKey, platform);

                await SyncRecipientsAsync(model.EventKey, platform);
            }

            await EntityRepository.SaveChangesAsync(cancellationToken);
        }

        private static void EnsureRawBodyIsSane(string? bodyHtml)
        {
            if (!string.IsNullOrEmpty(bodyHtml)
                && bodyHtml.Length > NotificationSettingsValidationService.MaxBodyHtmlLength * 4)
                throw new ErrorModelException(GlobalErrorCode.EmailTemplateInvalid, HttpStatusCode.BadRequest,
                    "Email template body is too large.");
        }

        // Идентичность строки — пара (событие, платформа), а не Id: админка редактирует
        // «канал», а не строку таблицы (тот же приём, что в SiteSettingsUpdateService).
        private async Task UpsertChannelAsync(EmailActionKey eventKey, NotificationPlatformUpdateModel model)
        {
            var channel = await Context.Set<NotificationChannel>()
                                       .SingleOrDefaultAsync(x => x.EventKey == eventKey && x.Platform == model.Platform,
                                           cancellationToken);

            if (channel is null)
            {
                channel = new NotificationChannel { EventKey = eventKey, Platform = model.Platform };
                Context.Set<NotificationChannel>().Add(channel);
            }

            channel.IsEnabled = model.IsEnabled;
        }

        // Идентичность записи — ActionKey. Санитизация ДО записи: в БД должно лечь ровно то,
        // что уйдёт в письмо. Обе языковые версии чистятся одинаково (ADR 026).
        private async Task UpsertTemplateAsync(EmailActionKey eventKey, NotificationPlatformUpdateModel model)
        {
            var template = await Context.Set<EmailTemplate>()
                                        .SingleOrDefaultAsync(x => x.ActionKey == eventKey, cancellationToken);

            if (template is null)
            {
                template = new EmailTemplate { ActionKey = eventKey };
                Context.Set<EmailTemplate>().Add(template);
            }

            template.Subject = RichHtmlSanitizer.ToPlainText(model.Subject);
            template.BodyHtml = RichHtmlSanitizer.Sanitize(model.BodyHtml, HtmlContentProfile.EmailBody);

            // Пустой перевод остаётся пустым, а не превращается в "" после санитайзера:
            // «перевода нет» и «перевод — пустая строка» для фолбэка одно и то же, но
            // хранить в БД мусор незачем.
            template.SubjectEn = string.IsNullOrWhiteSpace(model.SubjectEn)
                ? null
                : RichHtmlSanitizer.ToPlainText(model.SubjectEn);

            template.BodyHtmlEn = string.IsNullOrWhiteSpace(model.BodyHtmlEn)
                ? null
                : RichHtmlSanitizer.Sanitize(model.BodyHtmlEn, HtmlContentProfile.EmailBody);
        }

        // Полная замена набора: строки с Id, которых нет во входном списке, удаляются;
        // с Id — обновляются; без Id — создаются.
        private async Task SyncRecipientsAsync(EmailActionKey eventKey, NotificationPlatformUpdateModel model)
        {
            var incoming = model.Recipients ?? [];

            var existing = await EntityRepository.AsQueryable()
                                                 .Where(x => x.EventKey == eventKey && x.Platform == model.Platform)
                                                 .ToListAsync(cancellationToken);

            var incomingIds = incoming.Select(x => x.Id).OfType<int>().ToHashSet();

            foreach (var stale in existing.Where(x => !incomingIds.Contains(x.Id)))
                EntityRepository.Delete(stale);

            foreach (var row in incoming)
            {
                var target = row.Id is null
                    ? null
                    : existing.FirstOrDefault(x => x.Id == row.Id);

                if (target is null)
                {
                    target = new NotificationRecipient { EventKey = eventKey, Platform = model.Platform };
                    await EntityRepository.AddAsync(target, cancellationToken);
                }

                Apply(row, target, model.Platform);
            }
        }

        private static void Apply(NotificationRecipientUpdateModel source, NotificationRecipient target,
            NotificationPlatform platform)
        {
            target.IsActive = source.IsActive;
            target.SortOrder = source.SortOrder;
            target.SourceType = source.SourceType;

            // У Telegram Type всегда null (валидация это уже проверила) — здесь просто
            // не даём ему просочиться при смене платформы строки.
            target.Type = platform == NotificationPlatform.Email ? source.Type : null;

            // Поля, не относящиеся к выбранному источнику, обнуляются: иначе строка,
            // переключённая с CustomEmail на User, тащила бы за собой мёртвый адрес.
            target.UserId = source.SourceType == NotificationRecipientSource.User ? source.UserId : null;

            target.OrderLinkedRole = source.SourceType == NotificationRecipientSource.OrderLinked
                ? source.OrderLinkedRole
                : null;

            target.CustomEmail = source.SourceType == NotificationRecipientSource.CustomEmail
                ? source.CustomEmail?.Trim()
                : null;
        }
    }
}
