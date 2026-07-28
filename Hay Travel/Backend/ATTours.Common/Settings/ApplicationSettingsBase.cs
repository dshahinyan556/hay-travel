using Microsoft.Extensions.Configuration;

namespace ATTours.Common.Settings
{
    public class ApplicationSettingsBase<T> where T : class, new()
    {
        protected ApplicationSettingsBase() { }

        private static IConfigurationRoot configuration;

        protected IConfigurationRoot Configuration
        {
            get
            {
                if (configuration == null)
                {
                    var builder = new ConfigurationBuilder()
                               .SetBasePath(Directory.GetCurrentDirectory())
                               .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
                               .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")}.json", optional: true)
                               .AddEnvironmentVariables();

                    configuration = builder.Build();
                }
                return configuration;
            }
        }

        private static readonly Lazy<T> lazy = new Lazy<T>(() => new T());
        public static T Instance => lazy.Value;
    }
}
