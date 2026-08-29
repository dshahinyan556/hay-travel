namespace ATTours.Common.Enums
{
    // Кто инициировал прогон фоновой задачи (ScheduledJobRun.TriggeredBy).
    // Едет наружу числом — админский экран по нему отличает плановый прогон от ручного,
    // а не парсит текст Summary.
    public enum JobTriggerType
    {
        // Плановый запуск по cron.
        Schedule = 1,
        // Кнопка «Запустить сейчас» в админке. Автор прогона — в ActorUserId/ActorFullName.
        Manual = 2
    }
}
