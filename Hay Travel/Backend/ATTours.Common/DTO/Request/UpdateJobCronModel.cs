namespace ATTours.Common.DTO.Request
{
    // Переопределение расписания задачи. Пустая строка = «вернуть дефолт каталога»:
    // отдельного эндпоинта сброса нет, потому что пустой override и есть отсутствие
    // override (см. ScheduledJob.CronExpression).
    public class UpdateJobCronModel
    {
        public string CronExpression { get; set; }
    }
}
