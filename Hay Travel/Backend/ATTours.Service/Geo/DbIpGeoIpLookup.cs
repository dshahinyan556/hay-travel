using ATTours.Common.Settings;
using MaxMind.Db;
using MaxMind.GeoIP2;
using Microsoft.Extensions.Logging;
using System.Net;

namespace ATTours.BusinessServices.Geo
{
    // Реализация поверх DB-IP City Lite (.mmdb, CC-BY). Пакет MaxMind.GeoIP2 используется
    // только как OSS-ридер формата — ни аккаунта, ни сервиса MaxMind проект не задействует.
    //
    // Singleton: DatabaseReader потокобезопасен и держит файл memory-mapped (~сотни МБ на
    // диске, но не в куче), открывать его на запрос было бы расточительно.
    //
    // Файл появляется асинхронно (его качает GeoIpDatabaseDownloadService уже после старта),
    // поэтому ридер открывается лениво и переоткрывается, когда файл заменили новым.
    public sealed class DbIpGeoIpLookup : IGeoIpLookup, IDisposable
    {
        // Неудачное открытие не повторяется на каждый запрос: битый/недокачанный файл иначе
        // стоил бы попытки разбора на каждом обращении к API.
        private static readonly TimeSpan OpenRetryInterval = TimeSpan.FromMinutes(1);

        // Как часто вообще проверяется, не заменили ли файл на диске.
        private static readonly TimeSpan FileCheckInterval = TimeSpan.FromMinutes(1);

        private readonly GeoIpSettings settings;
        private readonly ILogger<DbIpGeoIpLookup> logger;
        private readonly object gate = new();

        private DatabaseReader? reader;
        private DateTime readerFileWriteTimeUtc;
        private DateTime nextFileCheckUtc = DateTime.MinValue;
        private DateTime nextOpenAttemptUtc = DateTime.MinValue;
        private bool isDisposed;

        public DbIpGeoIpLookup(GeoIpSettings settings, ILogger<DbIpGeoIpLookup> logger)
        {
            this.settings = settings;
            this.logger = logger;
        }

        public GeoLocation? Lookup(string? ipAddress)
        {
            if (string.IsNullOrWhiteSpace(ipAddress) || !IPAddress.TryParse(ipAddress, out var parsedAddress))
                return null;

            // Kestrel отдаёт IPv4-клиента как ::ffff:a.b.c.d — в таком виде адрес в дереве
            // базы не находится.
            if (parsedAddress.IsIPv4MappedToIPv6)
                parsedAddress = parsedAddress.MapToIPv4();

            var currentReader = GetReader();
            if (currentReader is null)
                return null;

            try
            {
                if (!currentReader.TryCity(parsedAddress, out var response) || response is null)
                    return null;

                var countryCode = response.Country?.IsoCode;
                var countryName = response.Country?.Name;
                var city = response.City?.Name;

                // Адрес в базе есть, но ничего осмысленного о нём не известно (так выглядят
                // зарезервированные диапазоны) — для вызывающего это «не определилось».
                if (countryCode is null && countryName is null && city is null)
                    return null;

                return new GeoLocation(countryCode, countryName, city);
            }
            catch (Exception exception)
            {
                // Гео — необязательная справка: ни регистрацию, ни логин она ронять не должна.
                logger.LogWarning(exception, "GeoIP lookup failed for address {IpAddress}.", ipAddress);
                return null;
            }
        }

        private DatabaseReader? GetReader()
        {
            lock (gate)
            {
                if (isDisposed)
                    return null;

                var now = DateTime.UtcNow;
                if (reader is not null && now < nextFileCheckUtc)
                    return reader;

                var databasePath = settings.DatabasePath;
                var databaseFile = new FileInfo(databasePath);

                if (!databaseFile.Exists)
                {
                    CloseReader();
                    return null;
                }

                if (reader is not null && databaseFile.LastWriteTimeUtc == readerFileWriteTimeUtc)
                {
                    nextFileCheckUtc = now.Add(FileCheckInterval);
                    return reader;
                }

                if (reader is null && now < nextOpenAttemptUtc)
                    return null;

                try
                {
                    // MemoryMapped (режим по умолчанию): база не поднимается в кучу целиком.
                    var openedReader = new DatabaseReader(databasePath, FileAccessMode.MemoryMapped);

                    CloseReader();
                    reader = openedReader;
                    readerFileWriteTimeUtc = databaseFile.LastWriteTimeUtc;
                    nextFileCheckUtc = now.Add(FileCheckInterval);

                    logger.LogInformation("GeoIP database loaded from {DatabasePath}.", databasePath);
                    return reader;
                }
                catch (Exception exception)
                {
                    logger.LogWarning(exception, "GeoIP database at {DatabasePath} could not be opened; lookups return no location.", databasePath);
                    nextOpenAttemptUtc = now.Add(OpenRetryInterval);
                    return null;
                }
            }
        }

        private void CloseReader()
        {
            reader?.Dispose();
            reader = null;
        }

        public void Dispose()
        {
            lock (gate)
            {
                if (isDisposed)
                    return;

                isDisposed = true;
                CloseReader();
            }
        }
    }
}
