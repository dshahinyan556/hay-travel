using ATTours.Common.Enums;

namespace ATTours.Common.Infrastructure.Jobs
{
    // Граница, за которой начинается планировщик. Единственная реализация
    // (ATTours.ClientAPI/Jobs/HangfireJobDispatcher) — единственное место в решении,
    // знающее про Hangfire; смена планировщика = один файл.
    public interface IJobDispatcher
    {
        // Поставить задачу в очередь на немедленное выполнение (кнопка «Запустить сейчас»).
        // Возврата результата нет и быть не может: прогон выполняется в фоне, а его исход
        // читается из истории ScheduledJobRun.
        //
        // Параллельно с уже идущим прогоном ТОЙ ЖЕ задачи не выполнится — сериализацию
        // держит распределённая блокировка на стороне реализации.
        Task EnqueueAsync(string jobKey, JobTriggerType triggeredBy, int? actorUserId = null,
            string actorFullName = null, CancellationToken cancellationToken = default);

        // Привести расписание планировщика в соответствие с каталогом + строками ScheduledJob:
        // включённые задачи зарегистрировать/обновить, выключенные и исчезнувшие из каталога —
        // снять. Идемпотентно, вызывается на старте и после каждой правки задачи в админке.
        Task RescheduleAsync(CancellationToken cancellationToken = default);
    }
}
