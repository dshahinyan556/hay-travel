using ATTours.BusinessServices.Core.Info;
using ATTours.BusinessServices.Notifications;
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение настроек уведомлений: кому и по какой платформе уходит событие. Корневая
    // сущность — NotificationRecipient (её читают и резолвер отправки, и админский грид);
    // каналы и шаблоны дочитываются через тот же контекст, отдельного Info-сервиса на
    // восьмистрочную таблицу-рубильник заводить незачем.
    public class NotificationSettingsInfo : EntityInfoBase<NotificationRecipient>
    {
        // Платформы, у которых реализована фактическая отправка. Telegram добавлен вместе
        // с реальным транспортом (ADR 031): отправка есть, баннер «не реализовано» во фронте
        // гаснет по этому флагу.
        private static readonly HashSet<NotificationPlatform> ImplementedPlatforms =
            [NotificationPlatform.Email, NotificationPlatform.Telegram];

        // Порядок вкладок платформ в админке — фиксированный, не по значению enum'а
        // (Email первый как основной канал, Telegram — дублирующий).
        private static readonly NotificationPlatform[] PlatformOrder =
            [NotificationPlatform.Email, NotificationPlatform.Telegram];

        private readonly CancellationToken cancellationToken;

        public NotificationSettingsInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public NotificationSettingsInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        public NotificationSettingsInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        // User нужен и резолверу (Email + PreferredLanguage), и гриду (ФИО/адрес read-only).
        protected override IEntityQueryableRepository<NotificationRecipient> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository()
                       .Include(x => x.User);
        }

        // Активные получатели одного события по одной платформе — то, что читает отправка.
        public async Task<List<NotificationRecipient>> GetActiveRecipientsAsync(EmailActionKey key,
            NotificationPlatform platform)
        {
            var recipients = await GetAllAsync(recipient => recipient.EventKey == key
                                                            && recipient.Platform == platform
                                                            && recipient.IsActive);

            return [.. recipients.OrderBy(recipient => recipient.SortOrder).ThenBy(recipient => recipient.Id)];
        }

        // Все строки события по всем платформам — админский GET, включая неактивные.
        public async Task<List<NotificationRecipient>> GetRecipientsByEventAsync(EmailActionKey key)
        {
            var recipients = await GetAllAsync(recipient => recipient.EventKey == key);
            return [.. recipients.OrderBy(recipient => recipient.SortOrder).ThenBy(recipient => recipient.Id)];
        }

        public async Task<List<NotificationRecipient>> GetAllRecipientsAsync()
        {
            var recipients = await GetAllAsync();

            return [.. recipients.OrderBy(recipient => recipient.EventKey)
                                 .ThenBy(recipient => recipient.Platform)
                                 .ThenBy(recipient => recipient.SortOrder)
                                 .ThenBy(recipient => recipient.Id)];
        }

        public async Task<List<NotificationChannel>> GetChannelsAsync(EmailActionKey? key = null)
        {
            var query = Context.Set<NotificationChannel>().AsNoTracking();

            if (key is not null)
                query = query.Where(channel => channel.EventKey == key);

            return await query.ToListAsync(cancellationToken);
        }

        // Нет строки канала — считаем выключенным: письмо, которого админ не включал,
        // уходить не должно (то же «тихо не шлём», что было у отсутствующего шаблона).
        public async Task<bool> IsChannelEnabledAsync(EmailActionKey key, NotificationPlatform platform)
        {
            return await Context.Set<NotificationChannel>()
                                .AsNoTracking()
                                .AnyAsync(channel => channel.EventKey == key
                                                     && channel.Platform == platform
                                                     && channel.IsEnabled, cancellationToken);
        }

        // Событие + каналы + шаблон + получатели одним чтением. key == null — все 4 события
        // в порядке объявления EmailActionKey (как раньше делал EmailTemplateInfo.GetOrderedAsync).
        public async Task<List<NotificationEventView>> GetEventsAsync(EmailActionKey? key = null)
        {
            var keys = key is null
                ? EmailPlaceholders.AllKeys.OrderBy(actionKey => actionKey).ToList()
                : [key.Value];

            var channels = await GetChannelsAsync(key);

            var recipients = key is null
                ? await GetAllRecipientsAsync()
                : await GetRecipientsByEventAsync(key.Value);

            // Тот же контекст, свой using не нужен: владелец соединения — этот сервис.
            var templateInfo = new EmailTemplateInfo(Context, cancellationToken);
            var templates = await templateInfo.GetAllAsync();

            var views = new List<NotificationEventView>();

            foreach (var actionKey in keys)
            {
                var view = new NotificationEventView { EventKey = actionKey };

                foreach (var platform in PlatformOrder)
                {
                    var channel = channels.FirstOrDefault(x => x.EventKey == actionKey && x.Platform == platform);

                    view.Platforms.Add(new NotificationPlatformView
                    {
                        Platform = platform,
                        IsEnabled = channel?.IsEnabled ?? false,
                        IsImplemented = ImplementedPlatforms.Contains(platform),
                        // Шаблон есть только у Email: у Telegram письма нет вовсе.
                        Template = platform == NotificationPlatform.Email
                            ? templates.FirstOrDefault(template => template.ActionKey == actionKey)
                            : null,
                        Recipients = [.. recipients.Where(recipient => recipient.EventKey == actionKey
                                                                       && recipient.Platform == platform)]
                    });
                }

                views.Add(view);
            }

            return views;
        }
    }
}
