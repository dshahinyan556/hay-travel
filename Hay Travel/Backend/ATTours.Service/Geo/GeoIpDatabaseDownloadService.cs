using ATTours.Common.Settings;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Globalization;
using System.IO.Compression;
using System.Net;

namespace ATTours.BusinessServices.Geo
{
    // Скачивает DB-IP City Lite (.mmdb.gz) при старте приложения (решение Давида, 2026-08-09):
    // база под CC-BY переиздаётся ежемесячно и весит ~60 МБ — в git ей делать нечего.
    //
    // Никакая ошибка отсюда не должна ронять приложение: нет интернета/нет релиза/нет прав на
    // запись — API продолжает работать, а IGeoIpLookup до появления файла возвращает null.
    public class GeoIpDatabaseDownloadService : BackgroundService
    {
        private readonly GeoIpSettings settings;
        private readonly IHttpClientFactory httpClientFactory;
        private readonly ILogger<GeoIpDatabaseDownloadService> logger;

        public GeoIpDatabaseDownloadService(GeoIpSettings settings, IHttpClientFactory httpClientFactory,
            ILogger<GeoIpDatabaseDownloadService> logger)
        {
            this.settings = settings;
            this.httpClientFactory = httpClientFactory;
            this.logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                await EnsureDatabaseAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Приложение останавливается во время загрузки — это не сбой.
            }
            catch (Exception exception)
            {
                // BackgroundService по умолчанию гасит хост на необработанном исключении —
                // ради необязательной гео-справки этого допускать нельзя.
                logger.LogWarning(exception, "GeoIP database download failed; IP lookups return no location until a database file is available.");
            }
        }

        private async Task EnsureDatabaseAsync(CancellationToken cancellationToken)
        {
            var databasePath = settings.DatabasePath;

            if (!settings.DownloadOnStartup)
            {
                logger.LogInformation("GeoIP database download is disabled; expecting a file at {DatabasePath}.", databasePath);
                return;
            }

            if (IsFreshEnough(databasePath))
            {
                logger.LogInformation("GeoIP database at {DatabasePath} is up to date; download skipped.", databasePath);
                return;
            }

            var databaseDirectory = Path.GetDirectoryName(databasePath);
            if (!string.IsNullOrEmpty(databaseDirectory))
                Directory.CreateDirectory(databaseDirectory);

            var client = httpClientFactory.CreateClient(nameof(GeoIpDatabaseDownloadService));

            // Релиз текущего месяца публикуется не первого числа — при 404 отступаем назад
            // по месяцам, вместо того чтобы остаться вообще без базы.
            for (var monthsBack = 0; monthsBack <= settings.MaxMonthsBack; monthsBack++)
            {
                var releaseMonth = DateTime.UtcNow.AddMonths(-monthsBack);
                var downloadUrl = string.Format(CultureInfo.InvariantCulture, settings.DownloadUrlTemplate, releaseMonth);

                if (await TryDownloadAsync(client, downloadUrl, databasePath, cancellationToken))
                {
                    logger.LogInformation("GeoIP database downloaded from {DownloadUrl} to {DatabasePath}.", downloadUrl, databasePath);
                    return;
                }
            }

            logger.LogWarning("No GeoIP database release was found for the last {MaxMonthsBack} months; IP lookups return no location.",
                settings.MaxMonthsBack + 1);
        }

        private bool IsFreshEnough(string databasePath)
        {
            var databaseFile = new FileInfo(databasePath);
            return databaseFile.Exists
                   && databaseFile.Length > 0
                   && databaseFile.LastWriteTimeUtc > DateTime.UtcNow.AddDays(-settings.RefreshAfterDays);
        }

        private async Task<bool> TryDownloadAsync(HttpClient client, string downloadUrl, string databasePath, CancellationToken cancellationToken)
        {
            // Временный файл рядом с целевым: File.Move в пределах одного тома атомарен, и
            // прерванная закачка не оставит вместо базы её половину.
            var temporaryPath = databasePath + ".download";

            try
            {
                using var response = await client.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

                if (response.StatusCode == HttpStatusCode.NotFound)
                    return false;

                response.EnsureSuccessStatusCode();

                await using (var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken))
                await using (var decompressionStream = new GZipStream(responseStream, CompressionMode.Decompress))
                await using (var fileStream = new FileStream(temporaryPath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await decompressionStream.CopyToAsync(fileStream, cancellationToken);
                }

                File.Move(temporaryPath, databasePath, overwrite: true);
                return true;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                TryDeleteTemporaryFile(temporaryPath);
                throw;
            }
            catch (Exception exception)
            {
                // Отдельная ссылка могла не открыться по причинам, не связанным с релизом
                // (сеть, зеркало, занятый файл) — пробуем следующий месяц, а не падаем.
                logger.LogWarning(exception, "GeoIP database could not be downloaded from {DownloadUrl}.", downloadUrl);
                TryDeleteTemporaryFile(temporaryPath);
                return false;
            }
        }

        private void TryDeleteTemporaryFile(string temporaryPath)
        {
            try
            {
                if (File.Exists(temporaryPath))
                    File.Delete(temporaryPath);
            }
            catch (Exception exception)
            {
                logger.LogDebug(exception, "Temporary GeoIP download file {TemporaryPath} could not be removed.", temporaryPath);
            }
        }
    }
}
