using ATTours.Common.Infrastructure.SiteSettings;

namespace ATTours.BusinessServices.Jobs
{
    // Один параметр задачи в админской проекции: определение ключа из SiteSettingCatalog +
    // его текущее значение. Метаданные (тип поля, дефолт) не копируются в отдельные поля —
    // определение кладётся целиком, ровно как ScheduledJobView кладёт BackgroundJobDefinition,
    // а разворачивает их в DTO маппер.
    public class ScheduledJobParameterView
    {
        // Из SiteSettingCatalog — единственного источника правды по составу настроек
        // (ADR 002). Отсутствовать не может: параметр с ключом вне каталога в проекцию
        // не попадает (см. ScheduledJobInfo.BuildParameters).
        public required SiteSettingDefinition Definition { get; init; }

        // Текущее значение строкой — сохранённое, иначе дефолт каталога (тот же фолбэк,
        // по которому читают параметры сами джобы через SiteSettingsInfo). Не null.
        public required string Value { get; init; }
    }
}
