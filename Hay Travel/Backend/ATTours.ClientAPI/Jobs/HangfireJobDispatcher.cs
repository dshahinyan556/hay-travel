using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Settings;
using Hangfire;
using Hangfire.Storage;

namespace ATTours.ClientAPI.Jobs
{
    // ЕДИНСТВЕННОЕ место в решении, знающее про Hangfire. Всё остальное (каталог, реестр,
    // раннер, хендлеры) работает с IJobDispatcher/IBackgroundJobRunner и о планировщике не
    // подозревает — смена планировщика стоит переписывания этого файла, а не системы.
    //
    // Класс одновременно и ставит задачи в очередь, и служит точкой, которую планировщик
    // вызывает: Hangfire читает свои атрибуты с вызываемого метода, а вызываемый метод
    // обязан жить в проекте, где Hangfire вообще доступен.
    public class HangfireJobDispatcher : IJobDispatcher
    {
        // Префикс id повторяющихся задач в хранилище планировщика. Нужен, чтобы отличить
        // «наши» триггеры от чужих и снимать осиротевшие, не трогая посторонние.
        private const string RecurringJobIdPrefix = "attours-job:";

        // Ресурс распределённой блокировки. Ключ задачи в нём обязателен: блокировка должна
        // разделять прогоны ОДНОЙ задачи, а не все фоновые задачи между собой.
        private const string LockResourcePrefix = "attours-job-lock:";

        private readonly IBackgroundJobClient backgroundJobClient;
        private readonly IRecurringJobManager recurringJobManager;
        private readonly JobStorage jobStorage;
        private readonly IBackgroundJobRunner runner;
        private readonly ILogger<HangfireJobDispatcher> logger;

        public HangfireJobDispatcher(IBackgroundJobClient backgroundJobClient,
            IRecurringJobManager recurringJobManager, JobStorage jobStorage,
            IBackgroundJobRunner runner, ILogger<HangfireJobDispatcher> logger)
        {
            this.backgroundJobClient = backgroundJobClient;
            this.recurringJobManager = recurringJobManager;
            this.jobStorage = jobStorage;
            this.runner = runner;
            this.logger = logger;
        }

        public Task EnqueueAsync(string jobKey, JobTriggerType triggeredBy, int? actorUserId = null,
            string? actorFullName = null, CancellationToken cancellationToken = default)
        {
            // CancellationToken.None — плейсхолдер: Hangfire не сериализует токен, а
            // подставляет при выполнении свой, привязанный к остановке сервера.
            backgroundJobClient.Enqueue<HangfireJobDispatcher>(dispatcher =>
                dispatcher.ExecuteAsync(jobKey, triggeredBy, actorUserId, actorFullName, CancellationToken.None));

            return Task.CompletedTask;
        }

        public async Task RescheduleAsync(CancellationToken cancellationToken = default)
        {
            await using var registry = new ScheduledJobInfo(CommonSettings.Instance.ATToursConnectionString,
                cancellationToken);

            var stateByKey = (await registry.GetAllAsync())
                .Where(job => job.Key is not null)
                .ToDictionary(job => job.Key, StringComparer.Ordinal);

            foreach (var definition in BackgroundJobCatalog.All)
            {
                stateByKey.TryGetValue(definition.Key, out var state);

                // Пустой override = расписание из каталога. Читать дефолт здесь, а не
                // материализовать его в БД при создании строки, — единственный способ,
                // при котором правка расписания в коде доезжает до уже созданных задач.
                var cron = string.IsNullOrWhiteSpace(state?.CronExpression)
                    ? definition.DefaultCronExpression
                    : state!.CronExpression;

                var recurringJobId = RecurringJobIdPrefix + definition.Key;

                // Выключенная задача снимается с расписания, а не «регистрируется и молчит»:
                // иначе после включения она бы ещё и догнала пропущенные тики.
                if (state is null || !state.IsEnabled || string.IsNullOrWhiteSpace(cron))
                {
                    recurringJobManager.RemoveIfExists(recurringJobId);
                    continue;
                }

                // Cron считается в UTC (дефолт Hangfire). Осознанно: расписание задач —
                // операционная величина («03:00 UTC»), а не время, которое видит клиент;
                // армянское время нужно только там, где речь о календарном дне тура
                // (ArmeniaTimeZone).
                recurringJobManager.AddOrUpdate<HangfireJobDispatcher>(recurringJobId,
                    dispatcher => dispatcher.ExecuteAsync(definition.Key, JobTriggerType.Schedule,
                        null, null, CancellationToken.None),
                    cron);
            }

            RemoveOrphanedRecurringJobs();
        }

        // Точка входа планировщика. Public и невиртуальный не случайно: Hangfire строит по
        // этому методу выражение и читает с него свои атрибуты.
        //
        // [AutomaticRetry(Attempts = 0)] — ретраев нет намеренно: все задачи периодические,
        // следующий тик и есть ретрай, а слепой повтор через минуту после сбоя БД только
        // размножил бы строки в истории прогонов.
        //
        // Штатного [DisableConcurrentExecution] здесь НЕТ сознательно: он берёт ресурс
        // блокировки как «тип + имя метода», без аргументов, — а через этот единственный
        // метод проходят ВСЕ задачи, так что уборка логов не смогла бы идти одновременно
        // с автозакрытием дней. Блокировка ниже делается вручную и по ключу задачи.
        [AutomaticRetry(Attempts = 0)]
        public async Task ExecuteAsync(string jobKey, JobTriggerType triggeredBy, int? actorUserId,
            string? actorFullName, CancellationToken cancellationToken)
        {
            using var connection = jobStorage.GetConnection();

            IDisposable distributedLock;
            try
            {
                // Нулевой таймаут: ждать освобождения незачем — плановый прогон повторится
                // по расписанию, а ручной админ повторит сам, когда текущий закончится.
                distributedLock = connection.AcquireDistributedLock(LockResourcePrefix + jobKey, TimeSpan.Zero);
            }
            catch (DistributedLockTimeoutException)
            {
                // Тот же ключ уже выполняется — в том числе на другом инстансе API.
                // Не ошибка: параллельный прогон одной задачи запрещён по определению.
                logger.LogInformation("Background job '{JobKey}' is already running; this trigger was dropped.", jobKey);
                return;
            }

            using (distributedLock)
            {
                // Раннер сам не бросает: любой исход уже записан строкой ScheduledJobRun.
                await runner.RunAsync(jobKey, triggeredBy, actorUserId, actorFullName, cancellationToken);
            }
        }

        // Задача, убранная из каталога, оставила бы в хранилище вечный триггер: он бы честно
        // срабатывал по расписанию и упирался в «нет такой задачи» до скончания века.
        private void RemoveOrphanedRecurringJobs()
        {
            using var connection = jobStorage.GetConnection();

            foreach (var recurringJob in connection.GetRecurringJobs())
            {
                if (!recurringJob.Id.StartsWith(RecurringJobIdPrefix, StringComparison.Ordinal))
                    continue;

                var jobKey = recurringJob.Id[RecurringJobIdPrefix.Length..];
                if (BackgroundJobCatalog.IsKnown(jobKey))
                    continue;

                logger.LogInformation("Recurring trigger of unknown background job '{JobKey}' removed.", jobKey);
                recurringJobManager.RemoveIfExists(recurringJob.Id);
            }
        }
    }
}
