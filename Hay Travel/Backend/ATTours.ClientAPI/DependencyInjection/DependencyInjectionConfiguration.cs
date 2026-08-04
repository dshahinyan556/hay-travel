using ATTours.BusinessServices.Email;
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

            // Stateless и потокобезопасны: work factor BCrypt и ключ подписи читаются один раз.
            services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
            services.AddSingleton<IJwtTokenService, JwtTokenService>();

            services.AddHttpClient(nameof(SendGridEmailSender));
            services.AddSingleton<IEmailSender>(serviceProvider =>
            {
                var emailSettings = serviceProvider.GetRequiredService<EmailSettings>();

                // Пока провайдер не настроен, письма только логируются, а токен возвращается
                // в ответе API — иначе локально нечем пройти verify/reset.
                if (!emailSettings.IsSendGridConfigured)
                    return new DevEmailSender(emailSettings, serviceProvider.GetRequiredService<ILogger<DevEmailSender>>());

                return new SendGridEmailSender(
                    emailSettings,
                    serviceProvider.GetRequiredService<ILogger<SendGridEmailSender>>(),
                    serviceProvider.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(SendGridEmailSender)));
            });

            // Scoped: AuthService владеет собственным DbContext и обязан быть освобождён
            // вместе с запросом.
            services.AddScoped<IAuthService, AuthService>();
        }

        public static void AddValidators(this IServiceCollection services)
        {

        }
    }
}
