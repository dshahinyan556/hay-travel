using ATTours.Common.Enums;

namespace ATTours.Common.Infrastructure.Jobs
{
    // То, что планировщик реально вызывает. Отделено от IBackgroundJobHandler намеренно:
    // хендлер отвечает только за свою бизнес-логику, а всё вокруг неё — проверка, что
    // задача включена, строка истории, перехват исключений, тримминг лога — живёт в одном
    // месте и одинаково для всех задач.
    //
    // Интерфейс объявлен здесь (Common), потому что его должны видеть обе стороны:
    // реализация в ATTours.Service и диспетчер в ATTours.ClientAPI.
    public interface IBackgroundJobRunner
    {
        // Никогда не бросает наружу: любой сбой — это строка ScheduledJobRun со статусом
        // Failed. Планировщику нечего ретраить (ретраи выключены осознанно), а падение
        // хендлера не должно выглядеть как падение самого прогона.
        Task RunAsync(string jobKey, JobTriggerType triggeredBy, int? actorUserId,
            string actorFullName, CancellationToken cancellationToken);
    }
}
