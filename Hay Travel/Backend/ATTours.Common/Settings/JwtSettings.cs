using Microsoft.Extensions.Configuration;

namespace ATTours.Common.Settings
{
    // Секция "Jwt" конфигурации. Ключ подписи (HS256) в репозитории не хранится:
    // в проде приходит из конфигурации App Service, локально — из appsettings.Development.json.
    public class JwtSettings : ApplicationSettingsBase<JwtSettings>
    {
        private const string SectionName = "Jwt";

        private IConfigurationSection Section => Configuration.GetSection(SectionName);

        public string SigningKey
        {
            get
            {
                var value = Section[nameof(SigningKey)];
                if (string.IsNullOrWhiteSpace(value))
                {
                    throw new InvalidOperationException(
                        $"Configuration value '{SectionName}:{nameof(SigningKey)}' is not set. " +
                        "Provide it via appsettings.{Environment}.json, the Jwt__SigningKey " +
                        "environment variable, or user-secrets before starting the application.");
                }

                return value;
            }
        }

        public string Issuer => Section[nameof(Issuer)] ?? "ATTours";

        public string Audience => Section[nameof(Audience)] ?? "ATTours.Client";

        public int AccessTokenMinutes => ReadInt(nameof(AccessTokenMinutes), 15);

        public int RefreshTokenDays => ReadInt(nameof(RefreshTokenDays), 14);

        private int ReadInt(string key, int fallback)
            => int.TryParse(Section[key], out var value) && value > 0 ? value : fallback;
    }
}
