namespace ATTours.Common.Settings
{
    public class CommonSettings : ApplicationSettingsBase<CommonSettings>
    {
        public string ATToursConnectionString
        {
            get
            {
                var value = Configuration.GetSection(nameof(ATToursConnectionString)).Value;
                if (string.IsNullOrWhiteSpace(value))
                {
                    throw new InvalidOperationException(
                        $"Configuration value '{nameof(ATToursConnectionString)}' is not set. " +
                        "Provide it via appsettings.{Environment}.json, the ATToursConnectionString " +
                        "environment variable, or user-secrets before starting the application.");
                }

                return value;
            }
        }

        public string AccessKey => Configuration.GetSection(nameof(AccessKey)).Value;
    }
}
