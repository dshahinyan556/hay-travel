using Microsoft.Extensions.Configuration;

namespace ATTours.Common.Settings
{
    // Секция "Cors" конфигурации. Origin'ы фронта задаются списком, а не "*", потому что
    // refresh-токен ездит в httpOnly-cookie: браузер отправляет её только при
    // Access-Control-Allow-Credentials: true, а он несовместим с Allow-Origin: *.
    public class CorsSettings : ApplicationSettingsBase<CorsSettings>
    {
        private const string SectionName = "Cors";

        private IConfigurationSection Section => Configuration.GetSection(SectionName);

        // Несколько origin'ов через запятую: dev-сервер, прод-домен и preview-деплои живут
        // одновременно, а добавление нового не должно требовать правки кода.
        public string[] AllowedOrigins => ParseOrigins(Section[nameof(AllowedOrigins)]);

        // Origin в CORS сравнивается посимвольно, поэтому хвостовой '/' в конфиге —
        // классическая причина "молча не работает": срезаем его сразу.
        private static string[] ParseOrigins(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return [];

            return value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Select(origin => origin.TrimEnd('/'))
                        .Where(origin => !string.IsNullOrWhiteSpace(origin))
                        .ToArray();
        }
    }
}
