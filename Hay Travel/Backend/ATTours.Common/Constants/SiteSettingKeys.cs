namespace ATTours.Common.Constants
{
    // Ключи настроек, которые читает КОД, а не только админка.
    //
    // Подавляющее большинство ключей SiteSettingCatalog контентные: их значение уходит на
    // фронт как есть, и в C# на них никто не ссылается — там строковый литерал в каталоге
    // самодостаточен. Эти четыре — противоположный случай: каждый читается из нескольких
    // мест (задача + валидация + публичный эндпоинт), и разъехавшийся литерал означал бы
    // молча взятый дефолт вместо настроенного порога, без единой ошибки в логах.
    //
    // Сами определения (группа, тип, дефолт) по-прежнему живут в SiteSettingCatalog —
    // здесь только имена.
    public static class SiteSettingKeys
    {
        // За сколько часов до начала дня (по времени Армении) день перестаёт продаваться.
        // Читают: TourDateAutoClosureJob, OrderValidationService, ClosureRuleInfo,
        // OrderAutoCancellationJob (для проверки инварианта).
        public const string BookingAutoCloseLeadTimeHours = "booking.autoCloseLeadTimeHours";

        // Сколько часов до минимальной даты тура остаётся неподтверждённому заказу.
        public const string OrderAutoCancelDeadlineHours = "jobs.orderAutoCancel.deadlineHours";

        // Глубина хранения журнала входов (LoginHistory).
        public const string LoginHistoryRetentionDays = "jobs.loginHistoryCleanup.retentionDays";

        // Глубина хранения истории прогонов самих задач (ScheduledJobRun).
        public const string RunHistoryRetentionDays = "jobs.runHistory.retentionDays";

        // Режим темы по умолчанию. Раньше читал только фронт, с 2026-08-29 читает и код:
        // options этого ключа — единственный список допустимых значений
        // User.PreferredTheme (UserPreferencesValidationService), чтобы {dark, light}
        // не оказалось захардкожено вторым местом.
        public const string ThemeDefaultMode = "theme.defaultMode";
    }
}
