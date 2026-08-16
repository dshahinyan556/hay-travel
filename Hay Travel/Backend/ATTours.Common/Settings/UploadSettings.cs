using Microsoft.Extensions.Configuration;

namespace ATTours.Common.Settings
{
    // Секция "Upload" конфигурации — локальное хранилище загруженных изображений (заменяет
    // "URL как единственный способ" из stage-4, ADR решение 2026-08-15: URL остаётся
    // альтернативой, upload — второй способ получить ту же строку-URL).
    //
    // StoragePath — физический путь на диске, разный в контейнере (/app/uploads, смонтирован
    // как volume в docker-compose) и в локальной разработке. Публичный префикс НЕ настраивается
    // и всегда "/uploads" — и nginx (прод), и Startup.UseStaticFiles (dev) читают ровно этот
    // путь; делать его конфигурируемым было бы гибкостью без применения.
    public class UploadSettings : ApplicationSettingsBase<UploadSettings>
    {
        private const string SectionName = "Upload";

        private const string DefaultRelativeStoragePath = "uploads";

        public const string PublicUrlPrefix = "/uploads";

        private IConfigurationSection Section => Configuration.GetSection(SectionName);

        // Тот же приём, что и GeoIpSettings.DatabasePath: относительный путь резолвится от
        // каталога приложения, а не от текущей директории процесса.
        public string StoragePath
        {
            get
            {
                var configuredPath = Section[nameof(StoragePath)];
                if (string.IsNullOrWhiteSpace(configuredPath))
                    configuredPath = DefaultRelativeStoragePath;

                return Path.IsPathRooted(configuredPath)
                    ? configuredPath
                    : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, configuredPath));
            }
        }

        // 8 МБ хватает с большим запасом для фото с телефона/фотоаппарата, но не даёт
        // положить сервер одним запросом.
        public long MaxFileSizeBytes => ReadLong(nameof(MaxFileSizeBytes), 8_000_000);

        // Длинная сторона оригинала после сохранения — режем даже "оригинал", чтобы кто-то не
        // залил RAW-фото на 40 МП: для сайта это всё равно избыточно, а место на диске не бесконечно.
        public int MaxOriginalDimension => ReadInt(nameof(MaxOriginalDimension), 4000);

        // Длинная сторона у WebP-варианта — это то, что реально показывается на медленном
        // соединении, поэтому меньше, чем у оригинала.
        public int CompressedMaxDimension => ReadInt(nameof(CompressedMaxDimension), 1600);

        public int WebpQuality => ReadInt(nameof(WebpQuality), 75);

        public string[] AllowedContentTypes =>
            Section.GetSection(nameof(AllowedContentTypes)).Get<string[]>()
            ?? new[] { "image/jpeg", "image/png", "image/webp" };

        private int ReadInt(string key, int fallback)
            => int.TryParse(Section[key], out var value) && value > 0 ? value : fallback;

        private long ReadLong(string key, long fallback)
            => long.TryParse(Section[key], out var value) && value > 0 ? value : fallback;
    }
}
