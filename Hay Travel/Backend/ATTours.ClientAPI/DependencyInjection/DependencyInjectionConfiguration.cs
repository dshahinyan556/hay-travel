using ATTours.BusinessServices.Email;
using ATTours.BusinessServices.Geo;
using ATTours.BusinessServices.Jobs;
using ATTours.BusinessServices.Notifications;
using ATTours.BusinessServices.Security;
using ATTours.BusinessServices.Services.AuthServices;
using ATTours.BusinessServices.Telegram;
using ATTours.ClientAPI.Jobs;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Settings;
using ATTours.Helper.Security;
using ATTours.Helper.StartupAbstraction.DescriptorBuilders;
using Hangfire;
using Hangfire.SqlServer;
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
            services.AddSingleton(TelegramSettings.Instance);

            // Stateless и потокобезопасны: work factor BCrypt и ключ подписи читаются один раз.
            services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
            services.AddSingleton<IJwtTokenService, JwtTokenService>();

            // Мгновенный отзыв access-токенов после impersonation (ADR 030). Singleton
            // ОБЯЗАТЕЛЕН: смысл реестра — одна общая на процесс таблица; scoped-регистрация
            // давала бы каждому запросу пустую копию, и отзыв не работал бы вообще.
            services.AddSingleton<IAccessTokenRevocationRegistry, AccessTokenRevocationRegistry>();

            // Мгновенный отзыв ОДНОЙ сессии — «Завершить сеанс» в клиентском кабинете
            // (David, 2026-08-31). Отдельный синглтон от реестра выше: тот бьёт по всем
            // токенам пользователя разом (единственно верно для impersonation), этот —
            // по TokenHash конкретной сессии.
            services.AddSingleton<ISessionRevocationRegistry, SessionRevocationRegistry>();

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

            // Telegram-уведомления (ADR 031). Тот же приём, что у IEmailSender: реализация
            // выбирается по конфигу, поэтому транспорт живёт в DI, а не создаётся через `new`.
            services.AddHttpClient(nameof(TelegramApiSender));
            services.AddSingleton<ITelegramSender>(serviceProvider =>
            {
                var telegramSettings = serviceProvider.GetRequiredService<TelegramSettings>();

                if (telegramSettings.IsConfigured)
                    return new TelegramApiSender(
                        telegramSettings,
                        serviceProvider.GetRequiredService<ILogger<TelegramApiSender>>(),
                        serviceProvider.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(TelegramApiSender)));

                // Пока бот не настроен, сообщения только логируются — иначе локально нечем
                // проверить сборку текста уведомления.
                return new DevTelegramSender(serviceProvider.GetRequiredService<ILogger<DevTelegramSender>>());
            });

            // Scoped: владеет собственным DbContext и обязан быть освобождён вместе
            // с запросом (как AuthService).
            services.AddScoped<ITelegramLinkService, TelegramLinkService>();

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

            // Письма заказов (Задача E). Через DI, а не `new` в контроллере, ровно по тому же
            // обоснованию, что и IEmailSender (ADR 005): сервису нужен внедрённый singleton
            // отправителя, реализация которого выбирается по конфигу. Scoped — живёт запрос.
            services.AddScoped<IOrderNotificationService, OrderNotificationService>();
        }

        // Фоновые задачи. Третье осознанное DI-исключение из «сервисы через new» (ADR 005):
        // раннер и хендлеры инстанцирует сам планировщик, `new` в этой цепочке не существует
        // как способ вообще.
        public static void AddBackgroundJobs(this IServiceCollection services)
        {
            services.AddSingleton(HangfireSettings.Instance);

            services.AddHangfire(configuration => configuration
                .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                .UseSimpleAssemblyNameTypeSerializer()
                .UseRecommendedSerializerSettings()

                // Та же БД, что у приложения, но отдельная схема: служебные таблицы
                // планировщика не должны попадать в поле зрения EF-миграций, а второй
                // сервер БД ради трёх задач — расход без выгоды.
                .UseSqlServerStorage(CommonSettings.Instance.ATToursConnectionString, new SqlServerStorageOptions
                {
                    SchemaName = HangfireSettings.SchemaName,

                    // Схему создаёт сам Hangfire при первом старте — своей миграцией её
                    // не описать (это чужая, версионируемая пакетом структура).
                    PrepareSchemaIfNecessary = true,

                    // Рекомендованный набор для SQL Server: без него планировщик опрашивает
                    // очередь каждые 15 секунд поллингом, вместо того чтобы ждать сигнала.
                    SlidingInvisibilityTimeout = TimeSpan.FromMinutes(5),
                    QueuePollInterval = TimeSpan.Zero,
                    UseRecommendedIsolationLevel = true,
                    DisableGlobalLocks = true
                }));

            services.AddHangfireServer(options =>
            {
                var workerCount = HangfireSettings.Instance.WorkerCount;
                if (workerCount > 0)
                    options.WorkerCount = workerCount;
            });

            // Scoped: у раннера собственный DbContext, он обязан быть освобождён вместе с
            // прогоном — Hangfire создаёт под каждую задачу отдельный scope.
            services.AddScoped<IBackgroundJobRunner, BackgroundJobRunner>();
            services.AddScoped<IJobDispatcher, HangfireJobDispatcher>();

            // Hangfire активирует вызываемый тип через тот же контейнер, поэтому сам
            // диспетчер обязан быть в нём зарегистрирован конкретным типом, а не только
            // за интерфейсом.
            services.AddScoped<HangfireJobDispatcher>();

            // Хендлеры регистрируются циклом по каталогу через штатный ServiceDescriptorBuilder,
            // а не поимённо: добавление задачи в каталог автоматически означает и её
            // регистрацию — забыть невозможно.
            foreach (var definition in BackgroundJobCatalog.All)
                services.Add(new ServiceDescriptorBuilder(definition.HandlerType, ServiceLifetime.Scoped).CreateDescriptor());
        }

        public static void AddValidators(this IServiceCollection services)
        {

        }
    }
}
