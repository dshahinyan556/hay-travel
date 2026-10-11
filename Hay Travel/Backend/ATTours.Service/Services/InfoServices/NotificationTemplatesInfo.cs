using ATTours.BusinessServices.Core.Info;
using ATTours.Common.DTO.Info;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение библиотеки Notification Templates (2026-08-31) — открытый CRUD, в отличие от
    // NotificationSettingsInfo (закрытый набор из 5 событий).
    public class NotificationTemplatesInfo : EntityInfoBase<NotificationTemplate>
    {
        private readonly CancellationToken cancellationToken;

        public NotificationTemplatesInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public NotificationTemplatesInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        public NotificationTemplatesInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task<NotificationTemplate> GetByIdAsync(int id)
            => await GetEntityQueryableRepository().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        // Фильтр по Channel/BoundEntity — список экрана и, отдельно, пикер выбора шаблона на
        // карточке события «Настроек уведомлений» (там нужны только подходящие по каналу и
        // сущности). Оба параметра опциональны: без них — вся библиотека.
        public async Task<List<NotificationTemplate>> GetAllAsync(NotificationPlatform? channel,
            NotificationTemplateEntity? boundEntity)
        {
            var templates = await GetAllAsync(x =>
                (channel == null || x.Channel == channel)
                && (boundEntity == null || x.BoundEntity == boundEntity));

            return [.. templates.OrderBy(x => x.Name)];
        }

        // Где шаблон сейчас назначен — read-only блок карточки И основание для блокировки
        // удаления (NotificationTemplateDeletionService переиспользует этот же метод, чтобы
        // не дублировать логику).
        public async Task<List<NotificationTemplateUsageInfoModel>> GetUsagesAsync(int templateId)
        {
            var usages = new List<NotificationTemplateUsageInfoModel>();

            var channels = await Context.Set<NotificationChannel>()
                                        .AsNoTracking()
                                        .Where(x => x.TemplateId == templateId)
                                        .ToListAsync(cancellationToken);

            usages.AddRange(channels.Select(channel => new NotificationTemplateUsageInfoModel
            {
                EventKey = channel.EventKey,
                Platform = channel.Platform
            }));

            var trigger = await Context.Set<NotificationTemplate>()
                                       .AsNoTracking()
                                       .Where(x => x.Id == templateId)
                                       .Select(x => x.Trigger)
                                       .FirstOrDefaultAsync(cancellationToken);

            if (trigger != NotificationTemplateTrigger.None)
                usages.Add(new NotificationTemplateUsageInfoModel { Trigger = trigger });

            return usages;
        }
    }
}
