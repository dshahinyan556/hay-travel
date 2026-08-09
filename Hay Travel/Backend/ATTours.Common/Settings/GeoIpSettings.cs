using Microsoft.Extensions.Configuration;

namespace ATTours.Common.Settings
{
    // Секция "GeoIp" конфигурации (B, 2026-08-09). Сама база (DB-IP City Lite, .mmdb, CC-BY)
    // в репозитории не хранится — она весит десятки мегабайт и переиздаётся ежемесячно,
    // поэтому её скачивает при старте GeoIpDatabaseDownloadService. Если файла нет,
    // lookup просто возвращает null (graceful degradation), приложение не падает.
    public class GeoIpSettings : ApplicationSettingsBase<GeoIpSettings>
    {
        private const string SectionName = "GeoIp";

        private const string DefaultRelativeDatabasePath = "App_Data/dbip-city-lite.mmdb";

        // Ежемесячный релиз DB-IP: {0:yyyy-MM} подставляет месяц, за который берётся база.
        private const string DefaultDownloadUrlTemplate = "https://download.db-ip.com/free/dbip-city-lite-{0:yyyy-MM}.mmdb.gz";

        private IConfigurationSection Section => Configuration.GetSection(SectionName);

        // Относительный путь резолвится от каталога приложения, а не от текущей директории
        // процесса: под IIS/Azure App Service вторая не совпадает с местом, куда развёрнут билд.
        public string DatabasePath
        {
            get
            {
                var configuredPath = Section[nameof(DatabasePath)];
                if (string.IsNullOrWhiteSpace(configuredPath))
                    configuredPath = DefaultRelativeDatabasePath;

                return Path.IsPathRooted(configuredPath)
                    ? configuredPath
                    : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, configuredPath));
            }
        }

        public string DownloadUrlTemplate => Section[nameof(DownloadUrlTemplate)] ?? DefaultDownloadUrlTemplate;

        // Выключатель для окружений без исходящего интернета: тогда база берётся только из
        // файла, положенного руками, а без него lookup молчит.
        public bool DownloadOnStartup => !string.Equals(Section[nameof(DownloadOnStartup)], "false", StringComparison.OrdinalIgnoreCase);

        // Свежий файл повторно не качается: 62 МБ на каждый рестарт приложения — слишком
        // дорого для базы, которая обновляется раз в месяц.
        public int RefreshAfterDays => ReadInt(nameof(RefreshAfterDays), 25);

        // Релиз текущего месяца появляется не первого числа: если его ещё нет (404),
        // откатываемся на предыдущие месяцы.
        public int MaxMonthsBack => ReadInt(nameof(MaxMonthsBack), 3);

        private int ReadInt(string key, int fallback)
            => int.TryParse(Section[key], out var value) && value > 0 ? value : fallback;
    }
}
