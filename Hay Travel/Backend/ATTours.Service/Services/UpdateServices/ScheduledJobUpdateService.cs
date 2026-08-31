using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Infrastructure.SiteSettings;
using ATTours.Common.Settings;
using ATTours.ContextRepository;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Правка состояния фоновой задачи из админки: рубильник и переопределение расписания.
    // Всё остальное (название, хендлер, дефолтный cron) неизменяемо и живёт в
    // BackgroundJobCatalog — редактировать там нечего.
    //
    // IJobDispatcher внедряется через конструктор — то самое обоснованное исключение из
    // «сервисы через new» (ADR 005): реализация диспетчера обёрнута вокруг singleton'ов
    // планировщика (IRecurringJobManager/JobStorage), собрать её `new` нельзя в принципе.
    // Контроллер получает диспетчер из контейнера и передаёт сюда.
    public class ScheduledJobUpdateService : RepositoryCoreBase<ScheduledJob, ATToursContextFactory>
    {
        private readonly IJobDispatcher jobDispatcher;
        private readonly CancellationToken cancellationToken;

        public ScheduledJobUpdateService(IJobDispatcher jobDispatcher, CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.jobDispatcher = jobDispatcher;
            this.cancellationToken = cancellationToken;
        }

        // Включение/выключение задачи. Выключенная снимается с расписания планировщика
        // немедленно, а не «со следующего рестарта» — иначе рубильник ничего не гарантировал бы.
        public async Task<ScheduledJob> SetEnabledAsync(string key, bool isEnabled)
        {
            var definition = JobsValidationService.EnsureKnownJob(key);

            var job = await GetOrCreateAsync(definition);
            job.IsEnabled = isEnabled;

            return await SaveAndRescheduleAsync(job);
        }

        // Переопределение расписания. Пустая строка стирает override — задача возвращается
        // к дефолту каталога (отдельного эндпоинта сброса поэтому и нет).
        public async Task<ScheduledJob> SetCronAsync(string key, string cronExpression)
        {
            var definition = JobsValidationService.EnsureKnownJob(key);
            JobsValidationService.ValidateCronExpression(cronExpression);

            var job = await GetOrCreateAsync(definition);
            job.CronExpression = string.IsNullOrWhiteSpace(cronExpression) ? null : cronExpression.Trim();

            return await SaveAndRescheduleAsync(job);
        }

        // Параметры задачи (пороги/ретеншены) с её собственного экрана. Значения физически
        // живут в общей таблице SiteSetting (ADR 002) — здесь только вход под правом
        // jobs:Update: PUT api/SiteSettings/Update гейтится правом settings:Update, и роль,
        // которой доверили задачи, иначе не смогла бы сохранить параметр собственной задачи.
        //
        // Сам upsert не переписывается: вызывается ровно тот SiteSettingsUpdateService,
        // которым сохраняет настройки экран «Настройки сайта» — вместе с его валидацией
        // (известность ключа, число у Number, дубликаты) и правилом идентичности по Key.
        //
        // RescheduleAsync здесь намеренно нет: параметры читает сам хендлер в момент
        // прогона, на расписание они не влияют. ScheduledJob.UpdatedAtUtc тоже не трогается —
        // он документирует правку строки реестра (рубильник/cron), а не значения в другой
        // таблице.
        public async Task SetParametersAsync(string key, IDictionary<string, string> values)
        {
            var definition = JobsValidationService.EnsureKnownJob(key);
            JobsValidationService.ValidateParameterKeys(definition, values);

            await UpsertSettingValuesAsync(values);
        }

        // Параметры самого экрана задач (BackgroundJobCatalog.ScreenParameterKeys) — те, что
        // читает ядро, а не отдельный хендлер (глубина хранения истории прогонов). Путь записи
        // тот же, что у параметров задачи, отличается только список разрешённых ключей:
        // задачи-владельца у них нет, поэтому и ключа задачи в сигнатуре нет.
        public async Task SetScreenParametersAsync(IDictionary<string, string> values)
        {
            JobsValidationService.ValidateScreenParameterKeys(values);

            await UpsertSettingValuesAsync(values);
        }

        private async Task UpsertSettingValuesAsync(IDictionary<string, string> values)
        {
            var settings = values.Select(pair => new SiteSetting
            {
                Key = pair.Key,
                Value = pair.Value?.Trim()
            }).ToList();

            // Инвариант, который иначе стоил бы данных: upsert настроек сверяет переводы по
            // списку из запроса, а тело PATCH переводов не содержит — переводимый параметр
            // потерял бы их все. Сегодня недостижимо (все параметры задач — Number,
            // isTranslatable: false), поэтому это не ошибка пользователя, а ошибка каталога,
            // и падать на ней надо громко, а не молча стирать переводы.
            var translatableParameter = settings.Select(setting => SiteSettingCatalog.ByKey(setting.Key))
                                                .FirstOrDefault(settingDefinition => settingDefinition?.IsTranslatable == true);

            if (translatableParameter is not null)
                throw new InvalidOperationException(
                    $"Site setting '{translatableParameter.Key}' is translatable and cannot be a background job parameter.");

            // Сервис настроек работает на том же контексте; сознательно не оборачиваем в
            // using — владелец контекста здесь, и его Dispose закрыл бы соединение раньше
            // времени (тот же приём, что в SiteSettingsUpdateService.UpsertAsync).
            var settingsUpdateService = new SiteSettingsUpdateService(settings, Context, cancellationToken);

            // ExecuteEntityChangesAsync, а не UpsertAsync: слитый список настроек здесь
            // никому не нужен — ответом эндпоинта служит перечитанная карточка задачи.
            await settingsUpdateService.ExecuteEntityChangesAsync();
        }

        // Строку реестра обычно создаёт ScheduledJobRegistrySync на старте. Но задача,
        // добавленная в каталог, может быть открыта в админке раньше рестарта соседнего
        // инстанса — отвечать 404 на существующий в каталоге ключ было бы враньём, поэтому
        // строка создаётся здесь по дефолтам каталога.
        private async Task<ScheduledJob> GetOrCreateAsync(BackgroundJobDefinition definition)
        {
            var job = await EntityRepository.AsQueryable()
                                            .FirstOrDefaultAsync(row => row.Key == definition.Key, cancellationToken);

            if (job is not null)
                return job;

            job = new ScheduledJob
            {
                Key = definition.Key,
                IsEnabled = definition.EnabledByDefault,
                CronExpression = null
            };

            await EntityRepository.AddAsync(job, cancellationToken);
            return job;
        }

        // Сохранение и синхронизация планировщика — всегда вместе: расписание в БД, не
        // доехавшее до планировщика, означало бы задачу, которая «включена» на экране и не
        // выполняется в реальности. RescheduleAsync идемпотентен и приводит в соответствие
        // сразу все задачи, поэтому вызывается без параметров.
        private async Task<ScheduledJob> SaveAndRescheduleAsync(ScheduledJob job)
        {
            job.UpdatedAtUtc = DateTime.UtcNow;

            await EntityRepository.SaveChangesAsync(cancellationToken);
            await jobDispatcher.RescheduleAsync(cancellationToken);

            return job;
        }
    }
}
