using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Одна строка истории прогонов. Плоская проекция ScheduledJobRun 1:1: экран «Джобы»
    // показывает и успехи, и пропуски, и падения — усечение набора полей здесь означало бы
    // разбор инцидента по SQL-консоли вместо админки.
    public class ScheduledJobRunInfoModel
    {
        public int Id { get; set; }

        // Дублирует ключ задачи, хотя история всегда запрашивается по конкретной задаче:
        // тот же DTO вложен в карточку задачи как LastRun, и там связь с ключом не очевидна
        // из контекста запроса.
        public string JobKey { get; set; }

        public DateTime StartedAtUtc { get; set; }

        // null = прогон ещё идёт (или процесс упал, не закрыв строку).
        public DateTime? FinishedAtUtc { get; set; }

        public JobRunStatus Status { get; set; }

        public int AffectedCount { get; set; }

        // Русская строка «что сделала задача» — то, что админ читает первым.
        public string Summary { get; set; }

        // Заполнен только у Failed.
        public string Error { get; set; }

        public JobTriggerType TriggeredBy { get; set; }

        // Кто нажал «Запустить сейчас». null у планового прогона.
        public int? ActorUserId { get; set; }
        public string ActorFullName { get; set; }
    }
}
