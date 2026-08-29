using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Settings;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ATTours.BusinessServices.Jobs
{
    // Всё, что происходит вокруг бизнес-логики задачи: проверка, что задачу вообще можно
    // запускать, строка истории, перехват исключений, тримминг лога. Один раз здесь —
    // вместо копипасты в каждом хендлере, который иначе рано или поздно забыл бы
    // записать свой провал.
    //
    // Планировщик вызывает ИМЕННО этот класс, а не хендлер напрямую: так Hangfire остаётся
    // заперт в ATTours.ClientAPI/Jobs, а хендлеры — обычные сервисы.
    //
    // Доступ к БД — как у соседних сервисов: свой контекст по строке из CommonSettings;
    // DI отвечает только за коллабораторов (ADR 005).
    public class BackgroundJobRunner : TourRepositoryCoreBase<ScheduledJobRun>, IBackgroundJobRunner
    {
        // Верхняя граница одной уборки истории. Без неё первый прогон после долгого простоя
        // (или после уменьшения ретеншена) вытянул бы в память всю таблицу разом; отставание
        // добирается следующими прогонами — задача идёт по расписанию, спешить некуда.
        private const int MaxPrunedRunsPerExecution = 500;

        private const int MaxSummaryLength = 1000;
        private const int MaxErrorLength = 2000;

        private readonly IServiceProvider serviceProvider;
        private readonly ILogger<BackgroundJobRunner> logger;

        public BackgroundJobRunner(IServiceProvider serviceProvider, ILogger<BackgroundJobRunner> logger)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.serviceProvider = serviceProvider;
            this.logger = logger;
        }

        private IEntityRepository<ScheduledJobRun> RunRepository => EntityRepository;

        private IEntityRepository<ScheduledJob>? jobRepository;
        private IEntityRepository<ScheduledJob> JobRepository => jobRepository ??= new EntityRepository<ScheduledJob>(Context);

        public async Task RunAsync(string jobKey, JobTriggerType triggeredBy, int? actorUserId,
            string? actorFullName, CancellationToken cancellationToken)
        {
            var definition = BackgroundJobCatalog.ByKey(jobKey);
            if (definition is null)
            {
                // Задача выпала из каталога, а в планировщике остался её триггер. Строку
                // истории не пишем: показать её всё равно негде — экран «Джобы» строится
                // по каталогу.
                logger.LogWarning("Background job '{JobKey}' is not in the catalog; execution skipped.", jobKey);
                return;
            }

            var job = await JobRepository.AsQueryable()
                                         .FirstOrDefaultAsync(row => row.Key == jobKey, cancellationToken);

            // IsEnabled гейтит только расписание: ручной запуск обязан работать и на
            // выключенной задаче — админ включает "Запустить сейчас" именно чтобы проверить
            // задачу, которую сам же выключил, а не чтобы получить второй способ её включить.
            if (job is null || (!job.IsEnabled && triggeredBy == JobTriggerType.Schedule))
            {
                // Отказ фиксируем в истории, а не молча: «задача не отработала, потому что
                // выключена» — ровно тот ответ, который админ ищет, когда заказы перестали
                // отменяться.
                await WriteSkippedRunAsync(jobKey, triggeredBy, actorUserId, actorFullName,
                    job is null ? "Задача не зарегистрирована в реестре." : "Задача выключена.",
                    cancellationToken);
                return;
            }

            var run = new ScheduledJobRun
            {
                JobKey = jobKey,
                StartedAtUtc = DateTime.UtcNow,
                Status = JobRunStatus.Running,
                TriggeredBy = triggeredBy,
                ActorUserId = actorUserId,
                ActorFullName = Truncate(actorFullName, 200)
            };

            // Строка создаётся ДО вызова хендлера: если процесс упадёт или контейнер
            // перезапустят на середине, в истории останется незакрытый прогон
            // (FinishedAtUtc = null) — это видно, в отличие от полного отсутствия записи.
            await RunRepository.AddAsync(run, cancellationToken);
            await RunRepository.SaveChangesAsync(cancellationToken);

            var context = new JobExecutionContext(jobKey, run.Id, triggeredBy, actorUserId,
                actorFullName, run.StartedAtUtc);

            var result = await ExecuteHandlerAsync(definition, context, cancellationToken);

            run.FinishedAtUtc = DateTime.UtcNow;
            run.Status = result.Status;
            run.AffectedCount = result.AffectedCount;
            run.Summary = Truncate(ComposeSummary(result.Summary, context.Warnings), MaxSummaryLength);
            run.Error = Truncate(result.Error, MaxErrorLength);

            RunRepository.Update(run);

            // Закрытие строки и уборка истории — одним SaveChanges: отдельный вызов ради
            // тримминга ничего не даёт, а лишний round-trip даёт.
            await PruneHistoryAsync(jobKey, cancellationToken);
            await RunRepository.SaveChangesAsync(cancellationToken);

            logger.LogInformation("Background job '{JobKey}' finished with status {Status} (affected: {AffectedCount}).",
                jobKey, result.Status, result.AffectedCount);
        }

        // Единственное место, где исключение хендлера превращается в данные. Наружу не
        // выпускаем ничего: ретраи планировщика выключены осознанно, и «упавший» с его точки
        // зрения прогон дал бы только шум в дашборде поверх уже записанной строки Failed.
        private async Task<JobRunResult> ExecuteHandlerAsync(BackgroundJobDefinition definition,
            JobExecutionContext context, CancellationToken cancellationToken)
        {
            try
            {
                // Резолв по Type из каталога: обобщить до GetRequiredService<T>() нечем —
                // тип известен только в рантайме. Хендлеры зарегистрированы Scoped циклом
                // по тому же каталогу, поэтому промах здесь означает ошибку регистрации,
                // а не отсутствующую задачу.
                var handler = (IBackgroundJobHandler)serviceProvider.GetRequiredService(definition.HandlerType);

                return await handler.ExecuteAsync(context, cancellationToken)
                       ?? JobRunResult.Failed("Задача не вернула результат.",
                              $"{definition.HandlerType.Name}.ExecuteAsync returned null.");
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                // Остановка приложения — не сбой задачи. Отдельного статуса под это нет
                // намеренно: со стороны админа результат тот же — работа не выполнена.
                logger.LogInformation("Background job '{JobKey}' was cancelled by application shutdown.", context.JobKey);
                return JobRunResult.Skipped("Прогон прерван остановкой приложения.");
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Background job '{JobKey}' failed.", context.JobKey);
                return JobRunResult.Failed("Задача завершилась с ошибкой.",
                    $"{exception.GetType().Name}: {exception.Message}");
            }
        }

        private async Task WriteSkippedRunAsync(string jobKey, JobTriggerType triggeredBy, int? actorUserId,
            string? actorFullName, string reason, CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;

            await RunRepository.AddAsync(new ScheduledJobRun
            {
                JobKey = jobKey,
                StartedAtUtc = now,
                FinishedAtUtc = now,
                Status = JobRunStatus.Skipped,
                Summary = reason,
                TriggeredBy = triggeredBy,
                ActorUserId = actorUserId,
                ActorFullName = Truncate(actorFullName, 200)
            }, cancellationToken);

            await RunRepository.SaveChangesAsync(cancellationToken);
        }

        // Ретеншен истории. Живёт здесь, а не отдельной задачей: уборка за собой — часть
        // работы раннера, и отдельная задача-уборщик сама нуждалась бы в уборщике.
        private async Task PruneHistoryAsync(string jobKey, CancellationToken cancellationToken)
        {
            try
            {
                await using var settingsInfo = new SiteSettingsInfo(CommonSettings.Instance.ATToursConnectionString,
                    cancellationToken);
                var retentionDays = await settingsInfo.GetNumberAsync(SiteSettingKeys.RunHistoryRetentionDays);

                // 0 или меньше = «не чистить». Трактовать это как «удалить всё» значило бы
                // стирать историю от одной опечатки в настройке.
                if (retentionDays <= 0)
                    return;

                var threshold = DateTime.UtcNow.AddDays(-retentionDays);

                var expired = await RunRepository.AsQueryable()
                    .Where(run => run.JobKey == jobKey && run.StartedAtUtc < threshold)
                    .OrderBy(run => run.StartedAtUtc)
                    .Take(MaxPrunedRunsPerExecution)
                    .ToListAsync(cancellationToken);

                if (expired.Count > 0)
                    RunRepository.DeleteRange(expired);
            }
            catch (Exception exception)
            {
                // Не удалась уборка — прогон всё равно обязан быть записан. Обратный
                // порядок приоритетов (потерять отчёт, но подчистить лог) абсурден.
                logger.LogWarning(exception, "Trimming run history of background job '{JobKey}' failed.", jobKey);
            }
        }

        // Предупреждения — это «успех с оговорками»: они обязаны быть видны там же, где
        // отчёт, иначе о них узнают только из логов приложения, куда админ не ходит.
        private static string ComposeSummary(string summary, IReadOnlyList<string> warnings)
        {
            if (warnings.Count == 0)
                return summary;

            return $"{summary} Предупреждения: {string.Join("; ", warnings)}";
        }

        private static string? Truncate(string? value, int maxLength)
            => value is not null && value.Length > maxLength ? value[..maxLength] : value;
    }
}
