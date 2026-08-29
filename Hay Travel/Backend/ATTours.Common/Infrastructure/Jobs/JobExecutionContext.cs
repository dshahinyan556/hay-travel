using ATTours.Common.Enums;

namespace ATTours.Common.Infrastructure.Jobs
{
    // Всё, что хендлер знает о конкретном прогоне. Данных задачи здесь нет и не будет:
    // за ними хендлер идёт в свои сервисы/репозитории, а контекст несёт только метаданные
    // запуска и канал для предупреждений.
    public class JobExecutionContext
    {
        public JobExecutionContext(string jobKey, int runId, JobTriggerType triggeredBy,
            int? actorUserId, string actorFullName, DateTime startedAtUtc)
        {
            JobKey = jobKey;
            RunId = runId;
            TriggeredBy = triggeredBy;
            ActorUserId = actorUserId;
            ActorFullName = actorFullName;
            StartedAtUtc = startedAtUtc;
        }

        public string JobKey { get; }

        // Id уже созданной строки ScheduledJobRun: строка пишется до вызова хендлера,
        // чтобы прогон не потерялся, если процесс упадёт на середине.
        public int RunId { get; }

        public JobTriggerType TriggeredBy { get; }

        // Заполнены только у TriggeredBy == Manual. Имя — снапшот на момент запуска
        // (та же логика, что у OrderEvent.ActorFullName): учётку могут переименовать,
        // а история обязана показывать то, что было.
        public int? ActorUserId { get; }
        public string ActorFullName { get; }

        public DateTime StartedAtUtc { get; }

        private readonly List<string> warnings = [];

        // Частичные проблемы, из-за которых прогон НЕ считается провальным: получатель без
        // привязанного Telegram, одна недоступная запись из сотни. Раннер клеит их к Summary,
        // так что в админской истории они видны — «успех с оговорками» не должен выглядеть
        // как безоблачный успех.
        public IReadOnlyList<string> Warnings => warnings;

        public void AddWarning(string warning)
        {
            if (!string.IsNullOrWhiteSpace(warning))
                warnings.Add(warning);
        }
    }
}
