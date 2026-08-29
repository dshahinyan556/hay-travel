using Microsoft.Extensions.Configuration;

namespace ATTours.Common.Settings
{
    // Секция "Hangfire" конфигурации. Здесь только профиль развёртывания планировщика —
    // всё, что относится к бизнес-поведению задач (расписание, пороги, ретеншены), живёт
    // в БД (ScheduledJob) и SiteSettings, чтобы менялось без редеплоя.
    public class HangfireSettings : ApplicationSettingsBase<HangfireSettings>
    {
        private const string SectionName = "Hangfire";

        private IConfigurationSection Section => Configuration.GetSection(SectionName);

        // Схема Hangfire в той же БД, что и данные приложения. Отдельная схема, а не dbo:
        // служебные таблицы планировщика не должны перемешиваться с сущностями и попадать
        // в поле зрения EF-миграций.
        public const string SchemaName = "HangFire";

        // Встроенный дашборд /hangfire. По умолчанию ВЫКЛЮЧЕН: это не UI для Давида
        // (для него есть экран «Джобы» с ролевой моделью), а отладочный инструмент,
        // который отдаёт наружу всё содержимое очередей без авторизации приложения.
        // В проде включается только вместе с доступом по SSH-туннелю — в nginx маршрут
        // не проксируется.
        public bool DashboardEnabled => bool.TryParse(Section[nameof(DashboardEnabled)], out var value) && value;

        // Число рабочих потоков планировщика. 0/не задано = дефолт Hangfire
        // (min(ProcessorCount * 5, 20)), который для одного VPS с тремя короткими
        // задачами избыточен, но безвреден.
        public int WorkerCount => int.TryParse(Section[nameof(WorkerCount)], out var value) && value > 0 ? value : 0;
    }
}
