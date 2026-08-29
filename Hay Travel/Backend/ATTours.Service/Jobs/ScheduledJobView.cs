using ATTours.Common.Entities;
using ATTours.Common.Infrastructure.Jobs;
using Cronos;

namespace ATTours.BusinessServices.Jobs
{
    // Внутренний тип сборки админской проекции «Джобы»: определение из каталога + строка
    // состояния + последний прогон, одним чтением. Тот же приём, что у NotificationEventView:
    // сшивку источников делает Info-сервис, а маппер только разворачивает результат в DTO.
    public class ScheduledJobView
    {
        // Из BackgroundJobCatalog — единственного источника правды по составу задач.
        // Отсутствовать не может: список строится обходом каталога, а не таблицы.
        public required BackgroundJobDefinition Definition { get; init; }

        // null, если строка реестра ещё не создана (ScheduledJobRegistrySync не отработал —
        // например задачу добавили в каталог и открыли экран до рестарта). Тогда наружу
        // уходят дефолты каталога, а не пустая карточка.
        public ScheduledJob? State { get; init; }

        // null, если задача не запускалась ни разу.
        public ScheduledJobRun? LastRun { get; init; }

        // Есть незакрытый прогон (см. ScheduledJobInfo.GetRunningKeysAsync).
        public bool IsRunning { get; init; }

        // Параметры задачи с текущими значениями (пороги/ретеншены из SiteSettings).
        // Пусто у задачи, которая ничем не настраивается.
        public IReadOnlyList<ScheduledJobParameterView> Parameters { get; init; } = [];

        // Эффективное расписание: override админа, иначе дефолт каталога. Считается здесь,
        // а не во фронте и не в маппере — то же правило уже применяет планировщик
        // (HangfireJobDispatcher.RescheduleAsync), и третьей его копии быть не должно.
        public string EffectiveCronExpression
            => string.IsNullOrWhiteSpace(State?.CronExpression)
                ? Definition.DefaultCronExpression
                : State!.CronExpression;

        // Ближайший плановый запуск. Считается из cron-строки (Cronos — тот же разбор, что
        // и у планировщика), а не спрашивается у хранилища Hangfire: тянуть планировщик в
        // бизнес-слой ради одной даты нельзя, а расхождение возможно только на время
        // до ближайшего RescheduleAsync, который идёт сразу за любой правкой.
        //
        // null у выключенной задачи (она снята с расписания и следующего запуска не имеет)
        // и у нераспознанной cron-строки — попасть в БД она может только мимо API
        // (валидация не пропустит), и падать из-за этого на чтении списка незачем.
        public DateTime? NextRunAtUtc
        {
            get
            {
                var isEnabled = State?.IsEnabled ?? Definition.EnabledByDefault;
                if (!isEnabled || string.IsNullOrWhiteSpace(EffectiveCronExpression))
                    return null;

                var expression = EffectiveCronExpression.Trim();

                try
                {
                    var format = expression.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length == 6
                        ? CronFormat.IncludeSeconds
                        : CronFormat.Standard;

                    // Планировщик считает расписание в UTC (см. HangfireJobDispatcher) —
                    // здесь та же зона, иначе экран показывал бы не тот момент.
                    return CronExpression.Parse(expression, format)
                                         .GetNextOccurrence(DateTime.UtcNow);
                }
                catch (CronFormatException)
                {
                    return null;
                }
            }
        }
    }
}
