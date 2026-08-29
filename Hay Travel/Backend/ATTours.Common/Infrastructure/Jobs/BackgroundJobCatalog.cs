using ATTours.Common.Constants;

namespace ATTours.Common.Infrastructure.Jobs
{
    // Единственный источник правды по составу фоновых задач — тот же приём, что у
    // SiteSettingCatalog (ADR 002). Автодискавери по сборке сознательно НЕТ: список задач,
    // который админ видит и включает/выключает, не должен зависеть от того, что рефлексия
    // нашла в сборке.
    //
    // Добавить задачу = класс-хендлер + одна строка здесь. Ядро (раннер, диспетчер,
    // ScheduledJob/ScheduledJobRun, DI-регистрация, экран «Джобы») при этом не трогается.
    public static class BackgroundJobCatalog
    {
        // Ключи задач — kebab-case: они уезжают в маршрут (api/Jobs/{key}/Run) и в id
        // recurring-задачи планировщика, то есть это часть контракта, а не подпись.
        public const string OrderAutoCancellationKey = "order-auto-cancellation";
        public const string LoginHistoryCleanupKey = "login-history-cleanup";
        public const string TourDateAutoClosureKey = "tour-date-auto-closure";

        // Cron считается планировщиком в UTC (см. HangfireJobDispatcher): расписание — это
        // операционная величина, а армянское время нужно только там, где речь о календарном
        // дне тура (ArmeniaTimeZone внутри самих задач).
        //
        // HandlerType резолвится по имени сборки: ATTours.Common не ссылается на
        // ATTours.BusinessServices (и не должен — зависимость смотрит в другую сторону),
        // поэтому типы хендлеров берутся через Type.GetType с полным именем сборки.
        // Промах — исключение при инициализации каталога, то есть на старте приложения,
        // а не в 03:00 у первого тика.
        private static readonly IReadOnlyList<BackgroundJobDefinition> definitions =
        [
            // Parameters — это список полей, которые экран задачи рендерит как СВОИ
            // редактируемые поля, а не список всего, что хендлер вправе прочитать в рантайме.
            // Поэтому BookingAutoCloseLeadTimeHours здесь не объявлен, хотя
            // OrderAutoCancellationJob читает его ради инварианта «дедлайн отмены < порога
            // автозакрытия»: чужой параметр на чужой карточке только сбивает с толку, его
            // место — карточка tour-date-auto-closure.
            new(OrderAutoCancellationKey,
                "Автоотклонение неподтверждённых заказов",
                ResolveHandler("ATTours.BusinessServices.Jobs.OrderAutoCancellationJob"),
                defaultCronExpression: "*/15 * * * *",
                enabledByDefault: true,
                parameterKeys: [SiteSettingKeys.OrderAutoCancelDeadlineHours]),

            new(LoginHistoryCleanupKey,
                "Автоудаление истории входов",
                ResolveHandler("ATTours.BusinessServices.Jobs.LoginHistoryCleanupJob"),
                defaultCronExpression: "0 3 * * *",
                enabledByDefault: true,
                parameterKeys: [SiteSettingKeys.LoginHistoryRetentionDays]),

            new(TourDateAutoClosureKey,
                "Автозакрытие дат",
                ResolveHandler("ATTours.BusinessServices.Jobs.TourDateAutoClosureJob"),
                defaultCronExpression: "0 * * * *",
                enabledByDefault: true,
                parameterKeys: [SiteSettingKeys.BookingAutoCloseLeadTimeHours]),
        ];

        private const string HandlerAssemblyName = "ATTours.BusinessServices";

        private static Type ResolveHandler(string typeName)
            => Type.GetType($"{typeName}, {HandlerAssemblyName}", throwOnError: true);

        // Ключи сравниваются точно (Ordinal): ключ — часть контракта API.
        private static readonly IReadOnlyDictionary<string, BackgroundJobDefinition> definitionsByKey =
            definitions.ToDictionary(definition => definition.Key, StringComparer.Ordinal);

        public static IReadOnlyList<BackgroundJobDefinition> All => definitions;

        // null, если задача неизвестна (строка ScheduledJob осталась от удалённой из
        // каталога задачи — такие не запускаются и наружу не отдаются).
        public static BackgroundJobDefinition ByKey(string key)
            => key is not null && definitionsByKey.TryGetValue(key, out var definition) ? definition : null;

        public static bool IsKnown(string key) => key is not null && definitionsByKey.ContainsKey(key);
    }
}
