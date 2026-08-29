namespace ATTours.Common.Infrastructure.Jobs
{
    // Метаданные одной фоновой задачи. Живут в коде, а не в БД — ровно по тем же
    // основаниям, что у SiteSettingDefinition (ADR 002): состав задач никем не
    // редактируется, а HandlerType вообще неописуем строкой в таблице.
    //
    // В БД (ScheduledJob) уезжает только изменяемое состояние: включена/выключена и
    // переопределённый cron.
    public class BackgroundJobDefinition
    {
        public BackgroundJobDefinition(
            string key,
            string displayName,
            Type handlerType,
            string defaultCronExpression,
            bool enabledByDefault = true,
            IReadOnlyList<string> parameterKeys = null)
        {
            if (string.IsNullOrWhiteSpace(key))
                throw new ArgumentException("Background job key is required.", nameof(key));

            // Ошибка разработчика, а не пользователя: ловится при инициализации каталога,
            // то есть на старте приложения, а не в момент первого тика задачи в 03:00.
            if (handlerType is null || !typeof(IBackgroundJobHandler).IsAssignableFrom(handlerType))
                throw new ArgumentException(
                    $"Handler type of background job '{key}' must implement {nameof(IBackgroundJobHandler)}.",
                    nameof(handlerType));

            Key = key;
            DisplayName = displayName;
            HandlerType = handlerType;
            DefaultCronExpression = defaultCronExpression;
            EnabledByDefault = enabledByDefault;
            ParameterKeys = parameterKeys ?? [];
        }

        // Стабильный идентификатор задачи: и ключ строки ScheduledJob, и сегмент маршрута
        // (api/Jobs/{key}/Run), и id recurring-задачи в планировщике. kebab-case,
        // сравнивается Ordinal — часть контракта API, а не пользовательский ввод.
        public string Key { get; }

        // Название для админского экрана, по-русски. Не переводится: экран «Джобы» —
        // внутренний инструмент, а не контент сайта.
        public string DisplayName { get; }

        // Реализация IBackgroundJobHandler. Регистрируется в DI циклом по каталогу —
        // забыть зарегистрировать новую задачу невозможно.
        public Type HandlerType { get; }

        // Расписание по умолчанию (cron планировщика). Применяется, пока админ не задал
        // своё в ScheduledJob.CronExpression; правка этой строки в коде подхватывается
        // всеми задачами, у которых override не выставлен.
        public string DefaultCronExpression { get; }

        // Задача, заведённая выключенной, требует осознанного включения в админке —
        // так новая опасная задача не начинает работать сразу после деплоя.
        public bool EnabledByDefault { get; }

        // Ключи SiteSettings, которые читает эта задача (jobs.orderAutoCancel.deadlineHours
        // и т.п.). Сами определения ключей живут в SiteSettingCatalog — там их уже умеет
        // рендерить generic-админка настроек, и дублировать метаданные здесь незачем.
        // Инвариант: каждый ключ обязан существовать в SiteSettingCatalog.
        public IReadOnlyList<string> ParameterKeys { get; }
    }
}
