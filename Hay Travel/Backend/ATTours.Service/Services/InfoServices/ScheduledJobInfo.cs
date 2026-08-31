using ATTours.BusinessServices.Core.Info;
using ATTours.BusinessServices.Jobs;
using ATTours.Common.Entities;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Infrastructure.SiteSettings;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение реестра фоновых задач. Своей логики нет и не должно быть: состав задач задаёт
    // BackgroundJobCatalog, а таблица хранит только состояние (включена/cron) — слияние
    // этих двух источников делает потребитель (диспетчер расписания, экран «Джобы»).
    public class ScheduledJobInfo : EntityInfoBase<ScheduledJob>
    {
        // Прогон, не закрытый дольше этого срока, перестаёт считаться идущим. Без такой
        // границы любой рестарт контейнера посреди задачи (то есть каждый деплой) оставлял
        // бы вечную строку с FinishedAtUtc = null, и «Запустить сейчас» отвечал бы 409 до
        // истечения ретеншена истории. Реальную гонку двух прогонов держит не эта проверка,
        // а распределённая блокировка планировщика (HangfireJobDispatcher) — здесь только
        // дешёвый предварительный отказ и индикатор в админке.
        private static readonly TimeSpan OpenRunStaleAfter = TimeSpan.FromHours(2);

        private readonly CancellationToken cancellationToken;

        public ScheduledJobInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public ScheduledJobInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        public ScheduledJobInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        // Полная проекция экрана «Джобы»: каталог, поверх которого наложено состояние из БД
        // и последний прогон. Порядок — порядок каталога (он же порядок строк на экране).
        //
        // Строка ScheduledJob, ключа которой больше нет в каталоге, наружу не отдаётся —
        // ровно как у SiteSettings: такая задача ничего не запускает, но и не удаляется
        // вместе со своей историей.
        public async Task<List<ScheduledJobView>> GetViewsAsync()
        {
            // Ключ уникален индексом (ScheduledJobConfiguration), поэтому словарь строится
            // напрямую — тот же приём, что в HangfireJobDispatcher.RescheduleAsync.
            var stateByKey = (await GetAllAsync())
                .Where(job => job.Key is not null)
                .ToDictionary(job => job.Key, StringComparer.Ordinal);

            var lastRunByKey = await GetLastRunsAsync();
            var runningKeys = await GetRunningKeysAsync();
            var parameterValues = await GetParameterValuesAsync();

            var views = new List<ScheduledJobView>();

            foreach (var definition in BackgroundJobCatalog.All)
            {
                stateByKey.TryGetValue(definition.Key, out var state);
                lastRunByKey.TryGetValue(definition.Key, out var lastRun);

                views.Add(new ScheduledJobView
                {
                    Definition = definition,
                    State = state,
                    LastRun = lastRun,
                    IsRunning = runningKeys.Contains(definition.Key),
                    Parameters = BuildParameters(definition.ParameterKeys, parameterValues)
                });
            }

            return views;
        }

        // Параметры самого экрана задач (BackgroundJobCatalog.ScreenParameterKeys) — то, что
        // читает ядро, а не отдельный хендлер. Отдельный эндпоинт, а не поле в GetViewsAsync:
        // это параметры экрана, и подмешивать их в строку какой-то одной задачи означало бы
        // приписать их той задаче.
        public async Task<List<ScheduledJobParameterView>> GetScreenParameterViewsAsync()
        {
            var values = await GetRawSettingValuesAsync(BackgroundJobCatalog.ScreenParameterKeys.ToList());
            return BuildParameters(BackgroundJobCatalog.ScreenParameterKeys, values);
        }

        // Один прогон по id — источник страницы отчёта. Ключ задачи в условии не
        // косметика: без него api/Jobs/{a}/Runs/{id прогона задачи b} отдал бы чужую
        // запись под чужим маршрутом. null = такой строки у этой задачи нет.
        public async Task<ScheduledJobRun?> GetRunAsync(string jobKey, int runId)
        {
            return await RunQuery()
                .FirstOrDefaultAsync(run => run.Id == runId && run.JobKey == jobKey, cancellationToken);
        }

        // История одной задачи, новые сверху. take клампится вызывающим (контроллером):
        // здесь принимается уже проверенное число.
        public async Task<List<ScheduledJobRun>> GetRunsAsync(string jobKey, int take)
        {
            return await RunQuery()
                .Where(run => run.JobKey == jobKey)
                .OrderByDescending(run => run.StartedAtUtc)
                .ThenByDescending(run => run.Id)
                .Take(take)
                .ToListAsync(cancellationToken);
        }

        // Pre-check ручного запуска: есть ли у задачи живой незакрытый прогон.
        public async Task<bool> HasOpenRunAsync(string jobKey)
        {
            var staleThreshold = DateTime.UtcNow - OpenRunStaleAfter;

            return await RunQuery()
                .AnyAsync(run => run.JobKey == jobKey
                                 && run.FinishedAtUtc == null
                                 && run.StartedAtUtc >= staleThreshold, cancellationToken);
        }

        // Последний прогон каждой задачи каталога. Отдельным запросом на ключ, а не одним
        // GroupBy: задач единицы (их состав фиксирован каталогом), запрос точечный по
        // индексу (JobKey, StartedAtUtc), а транслируемость GroupBy+First зависит от
        // провайдера — цена «оптимизации» здесь была бы выше выгоды.
        private async Task<Dictionary<string, ScheduledJobRun>> GetLastRunsAsync()
        {
            var lastRuns = new Dictionary<string, ScheduledJobRun>(StringComparer.Ordinal);

            foreach (var definition in BackgroundJobCatalog.All)
            {
                var lastRun = await RunQuery()
                    .Where(run => run.JobKey == definition.Key)
                    .OrderByDescending(run => run.StartedAtUtc)
                    .ThenByDescending(run => run.Id)
                    .FirstOrDefaultAsync(cancellationToken);

                if (lastRun is not null)
                    lastRuns[definition.Key] = lastRun;
            }

            return lastRuns;
        }

        // Значения параметров всех задач каталога — одним чтением на весь экран, а не по
        // задаче: ключей единицы, а запрос на каждую строку экрана дал бы N+1 ради двух
        // чисел.
        //
        // Значения приходят из того же SiteSettingsInfo, которым читают свои пороги сами
        // джобы (GetNumberAsync) — правило «сохранённое, иначе дефолт каталога» живёт
        // там в единственном экземпляре, здесь оно не повторяется.
        private Task<Dictionary<string, string>> GetParameterValuesAsync()
        {
            var parameterKeys = BackgroundJobCatalog.All
                                                    .SelectMany(definition => definition.ParameterKeys)
                                                    .Distinct(StringComparer.Ordinal)
                                                    .ToList();

            return GetRawSettingValuesAsync(parameterKeys);
        }

        // Сырые значения набора ключей настроек. Общее место для параметров задач и
        // параметров экрана: правило «сохранённое, иначе дефолт каталога» живёт в
        // SiteSettingsInfo в единственном экземпляре, здесь только вызов.
        private async Task<Dictionary<string, string>> GetRawSettingValuesAsync(List<string> keys)
        {
            if (keys.Count == 0)
                return new Dictionary<string, string>(StringComparer.Ordinal);

            // Info настроек работает на том же контексте; сознательно не оборачиваем в
            // using — владелец контекста здесь, и его Dispose закрыл бы соединение раньше
            // времени (тот же приём, что в SiteSettingsUpdateService.UpsertAsync).
            var settingsInfo = new SiteSettingsInfo(Context, cancellationToken);
            return await settingsInfo.GetRawValuesAsync(keys);
        }

        // Параметры в порядке, объявленном каталогом (он же порядок полей на карточке) —
        // и для одной задачи, и для экрана целиком.
        private static List<ScheduledJobParameterView> BuildParameters(IReadOnlyList<string> parameterKeys,
            Dictionary<string, string> parameterValues)
        {
            var parameters = new List<ScheduledJobParameterView>(parameterKeys.Count);

            foreach (var key in parameterKeys)
            {
                var settingDefinition = SiteSettingCatalog.ByKey(key);

                // Инвариант BackgroundJobDefinition: каждый параметр обязан существовать в
                // SiteSettingCatalog. Если инвариант нарушен, экран задач не должен падать
                // целиком — параметр просто не показывается и не редактируется (тем же
                // ключом его отвергнет и валидация записи).
                if (settingDefinition is null)
                    continue;

                parameters.Add(new ScheduledJobParameterView
                {
                    Definition = settingDefinition,
                    Value = parameterValues.GetValueOrDefault(key) ?? settingDefinition.DefaultValue ?? string.Empty
                });
            }

            return parameters;
        }

        // Ключи задач с живым незакрытым прогоном — одним запросом на весь экран.
        private async Task<HashSet<string>> GetRunningKeysAsync()
        {
            var staleThreshold = DateTime.UtcNow - OpenRunStaleAfter;

            var keys = await RunQuery()
                .Where(run => run.FinishedAtUtc == null && run.StartedAtUtc >= staleThreshold)
                .Select(run => run.JobKey)
                .Distinct()
                .ToListAsync(cancellationToken);

            return keys.ToHashSet(StringComparer.Ordinal);
        }

        // История живёт в другой таблице, но своего Info-сервиса не заслуживает: она
        // читается только вместе с задачей и только этим экраном.
        private IQueryable<ScheduledJobRun> RunQuery()
            => Context.Set<ScheduledJobRun>().AsNoTracking();
    }
}
