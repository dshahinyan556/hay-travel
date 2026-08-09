using ATTours.BusinessServices.Email;
using ATTours.BusinessServices.Geo;
using ATTours.BusinessServices.Security;
using ATTours.BusinessServices.Services.AuthServices;
using ATTours.Common.Settings;
using Microsoft.Extensions.Logging;

namespace ATTours.ClientAPI.DependencyInjection
{
    public static class DependencyInjectionConfiguration
    {
        public static void AddDAL(this IServiceCollection services)
        {

        }

        // Auth-вертикаль — единственная, которая живёт через конструкторный DI (ADR 005):
        // выбор реализации IEmailSender по конфигу невыразим через `new` в контроллере.
        public static void AddServices(this IServiceCollection services)
        {
            services.AddSingleton(JwtSettings.Instance);
            services.AddSingleton(EmailSettings.Instance);
            services.AddSingleton(GeoIpSettings.Instance);

            // Stateless и потокобезопасны: work factor BCrypt и ключ подписи читаются один раз.
            services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
            services.AddSingleton<IJwtTokenService, JwtTokenService>();

            services.AddHttpClient(nameof(SendGridEmailSender));
            services.AddHttpClient(nameof(BrevoEmailSender));
            services.AddSingleton<IEmailSender>(serviceProvider =>
            {
                var emailSettings = serviceProvider.GetRequiredService<EmailSettings>();

                if (emailSettings.IsSendGridConfigured)
                    return new SendGridEmailSender(
                        emailSettings,
                        serviceProvider.GetRequiredService<ILogger<SendGridEmailSender>>(),
                        serviceProvider.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(SendGridEmailSender)));

                if (emailSettings.IsBrevoConfigured)
                    return new BrevoEmailSender(
                        emailSettings,
                        serviceProvider.GetRequiredService<ILogger<BrevoEmailSender>>(),
                        serviceProvider.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(BrevoEmailSender)));

                // Пока провайдер не настроен, письма только логируются, а токен возвращается
                // в ответе API — иначе локально нечем пройти verify/reset.
                return new DevEmailSender(emailSettings, serviceProvider.GetRequiredService<ILogger<DevEmailSender>>());
            });

            // Гео-IP (B, 2026-08-09). Singleton: DbIpGeoIpLookup держит открытым
            // memory-mapped файл базы и потокобезопасен — на запрос его пересоздавать нельзя.
            services.AddSingleton<IGeoIpLookup, DbIpGeoIpLookup>();

            // Таймаут по умолчанию (100 с) короче, чем реальная закачка ~60 МБ на медленном
            // канале, — иначе база не доезжала бы именно там, где она и нужна.
            services.AddHttpClient(nameof(GeoIpDatabaseDownloadService),
                client => client.Timeout = TimeSpan.FromMinutes(10));

            // Качает базу после старта, в фоне: старт приложения её не ждёт, а неудача
            // (нет сети/нет релиза) не мешает работать остальному API.
            services.AddHostedService<GeoIpDatabaseDownloadService>();

            // Scoped: AuthService владеет собственным DbContext и обязан быть освобождён
            // вместе с запросом.
            services.AddScoped<IAuthService, AuthService>();
        }

        public static void AddValidators(this IServiceCollection services)
        {

        }
    }
}
