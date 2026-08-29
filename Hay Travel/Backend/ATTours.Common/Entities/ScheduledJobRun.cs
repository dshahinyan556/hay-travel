using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // История прогонов. Пишется ВСЕГДА — включая Failed и Skipped: фоновая задача, которая
    // молча ничего не сделала, неотличима от несуществующей, и именно так пропадают
    // неотменённые заказы.
    //
    // Ретеншен — тримминг в раннере по настройке jobs.runHistory.retentionDays, а не
    // бесконечный рост таблицы.
    [EntityTypeConfiguration(typeof(ScheduledJobRunConfiguration))]
    public class ScheduledJobRun : EntityBase
    {
        // Ключ задачи строкой, а не FK на ScheduledJob: история переживает удаление задачи
        // из каталога (и, соответственно, строки реестра) — иначе разбор инцидента упирался
        // бы в то, что логи унесло каскадом.
        public string JobKey { get; set; }

        public DateTime StartedAtUtc { get; set; }

        // null = прогон ещё идёт (или процесс упал, не закрыв строку). Это же условие —
        // дешёвый pre-check «задача уже запущена» перед ручным запуском.
        public DateTime? FinishedAtUtc { get; set; }

        public JobRunStatus Status { get; set; }

        public int AffectedCount { get; set; }

        // Русская строка для админского экрана: что именно задача сделала.
        public string Summary { get; set; }

        // Текст исключения. Заполнен только у Failed.
        public string Error { get; set; }

        public JobTriggerType TriggeredBy { get; set; }

        // Кто нажал «Запустить сейчас». FK на User сознательно НЕ ставится — та же логика,
        // что у OrderEvent: операционный журнал не должен зависеть от жизненного цикла
        // учётки, имя уже денормализовано рядом.
        public int? ActorUserId { get; set; }
        public string ActorFullName { get; set; }
    }
}
