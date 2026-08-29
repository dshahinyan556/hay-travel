namespace ATTours.Common.Infrastructure.Jobs
{
    // Одна фоновая задача. Реализации живут в ATTours.Service/Jobs и о планировщике
    // (Hangfire) не знают ничего: их инстанцирует DI по BackgroundJobDefinition.HandlerType,
    // а вызывает раннер. Смена планировщика хендлеров не касается.
    //
    // Контракт: не бросать исключение как способ сообщить о неудаче (для этого есть
    // JobRunResult.Failed) и уважать cancellationToken — на остановке приложения прогон
    // обязан свернуться, а не держать хост.
    public interface IBackgroundJobHandler
    {
        Task<JobRunResult> ExecuteAsync(JobExecutionContext context, CancellationToken cancellationToken);
    }
}
