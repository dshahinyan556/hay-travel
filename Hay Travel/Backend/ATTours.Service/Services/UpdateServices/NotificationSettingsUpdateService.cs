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
            // Пустое тело запроса отбивает валидация — дальше model заведомо не null.
            await new NotificationSettingsValidationService(model, Context, cancellationToken).ValidateAsync();

            foreach (var platform in model!.Platforms ?? [])
            {
                await UpsertChannelAsync(model.EventKey, platform);
                await SyncRecipientsAsync(model.EventKey, platform);
            }

            await EntityRepository.SaveChangesAsync(cancellationToken);
        }

        // Идентичность строки — пара (событие, платформа), а не Id: админка редактирует
        // «канал», а не строку таблицы (тот же приём, что в SiteSettingsUpdateService).
        // Шаблон (Subject/BodyHtml и его санитизация) больше не живёт здесь — это отдельная
        // сущность NotificationTemplate со своим сервисом сохранения; здесь только ссылка.
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
            channel.TemplateId = model.TemplateId;
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
