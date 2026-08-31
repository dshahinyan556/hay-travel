using ATTours.BusinessServices.Jobs;
using ATTours.ClientAPI.DependencyInjection;
using ATTours.ClientAPI.Extensions;
using ATTours.ClientAPI.Jobs;
using ATTours.ClientAPI.Mapper.MappingProfile;
using ATTours.ClientAPI.Middleware;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Settings;
using ATTours.ContextRepository.Extensions;
using ATTours.DataLayer;
using ATTours.Helper.Interfaces;
using ATTours.Helper.MiddlewareAbstraction;
using ATTours.Helper.MvcRegistrars;
using ATTours.Helper.Security;
using ATTours.Helper.StartupAbstraction.ApiAbstraction;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using QuestPDF.Infrastructure;
using System.Security.Claims;
using System.Text;

namespace ATTours.ClientAPI
{
    public class Startup : StartupApiBase
    {
        public override void ConfigureServices(IServiceCollection services)
        {
            // Обязательный вызов до первой генерации PDF (Фаза 4, checklist-orders-redesign.txt),
            // иначе QuestPDF бросает исключение при первом Document.GeneratePdf().
            QuestPDF.Settings.License = LicenseType.Community;

            base.ConfigureServices(services);
            services.AddDAL();
            services.AddServices();
            services.AddBackgroundJobs();
            ConfigureAuthentication(services);
            services.AddAutoMapper(cfg =>
            {
                cfg.AddProfile<MappingProfile>();
                cfg.AllowNullCollections = true;
                cfg.AllowNullDestinationValues = true;
            });
            services.AddDbContext<ATToursContext>(options => options.UseSqlServer(CommonSettings.Instance.ATToursConnectionString));
        }

        protected override void ConfigureFactory(IApplicationBuilder app, IWebHostEnvironment env)
        {
            // Применяем ожидающие миграции при каждом старте API, чтобы не гонять
            // dotnet ef database update руками — БД сама подтягивается до актуальной схемы.
            app.ApplicationServices.MigrateDatabase<ATToursContext>();

            // Строго после миграций: синхронизация реестра пишет в таблицу ScheduledJob,
            // которую эти же миграции и создают.
            SynchronizeBackgroundJobs(app.ApplicationServices);

            // Раньше всего в конвейере: всё, что читает HttpContext.Connection.RemoteIpAddress
            // (GeoController, AuthController.BuildRequestContext -> LoginHistory/RegisteredIp,
            // UserActivityTrackingMiddleware), должно видеть уже подменённый адрес.
            // Чинится централизованно здесь — сами вызывающие остаются без изменений.
            app.UseForwardedHeaders(BuildForwardedHeadersOptions());

            app.UseMiddleware<InitializableMiddlewareBase<ATToursExceptionMaster>>();

            // Раздача загруженных изображений отдельно от MVC-роутинга. В проде nginx
            // перехватывает "/uploads/*" раньше, чем запрос вообще доходит до Kestrel (см.
            // docs/server-ops.md) — этот middleware реально работает только в локальной
            // разработке, где nginx нет. Держать его всё равно нужно: без него "/uploads" в
            // dev отдавал бы 404, а не файл.
            var uploadSettings = UploadSettings.Instance;
            Directory.CreateDirectory(uploadSettings.StoragePath);
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new PhysicalFileProvider(uploadSettings.StoragePath),
                RequestPath = UploadSettings.PublicUrlPrefix,
            });

            ConfigureHangfireDashboard(app);

            base.ConfigureFactory(app, env);
        }

        // Реестр задач приводится к каталогу и расписание — к реестру на каждом старте.
        // Не hosted-сервисом: и то и другое обязано случиться ДО того, как планировщик
        // начнёт разбирать очередь, а порядок запуска IHostedService такой гарантии не даёт.
        private static void SynchronizeBackgroundJobs(IServiceProvider serviceProvider)
        {
            using var scope = serviceProvider.CreateScope();
            var logger = scope.ServiceProvider.GetService<ILoggerFactory>()?.CreateLogger("ATTours.Startup.Jobs");

            try
            {
                using var registrySync = new ScheduledJobRegistrySync();
                var created = registrySync.SyncAsync().GetAwaiter().GetResult();

                if (created > 0)
                    logger?.LogInformation("Реестр фоновых задач пополнен: добавлено {Created} задач(и).", created);

                scope.ServiceProvider.GetRequiredService<IJobDispatcher>()
                     .RescheduleAsync()
                     .GetAwaiter()
                     .GetResult();
            }
            catch (Exception exception)
            {
                // Уровень Error, а не Warning: API продолжит обслуживать запросы, но
                // фоновые задачи по расписанию работать не будут — это ровно тот
                // молчаливый провал, который нельзя оставлять незаметным. Ронять при этом
                // весь сайт из-за планировщика — несоразмерно.
                logger?.LogError(exception, "Не удалось синхронизировать фоновые задачи: расписание не обновлено.");
            }
        }

        // Дашборд Hangfire — отладочный инструмент, а не часть админки: по умолчанию
        // выключен, а включённый пускает только локальные адреса (в проде — SSH-туннель,
        // в nginx маршрут не проксируется). Управление задачами для Давида — экран «Джобы»
        // с обычной ролевой моделью.
        private static void ConfigureHangfireDashboard(IApplicationBuilder app)
        {
            if (!HangfireSettings.Instance.DashboardEnabled)
                return;

            app.UseHangfireDashboard("/hangfire", new DashboardOptions
            {
                Authorization = [new LocalRequestsOnlyAuthorizationFilter()]
            });
        }

        // За Netlify -> Azure App Service до Kestrel доезжает исходный IP клиента только
        // в X-Forwarded-For: без этого RemoteIpAddress — это адрес прокси, и вся гео-IP
        // вертикаль (B) на проде показывала бы страну дата-центра, а не посетителя.
        private static ForwardedHeadersOptions BuildForwardedHeadersOptions()
        {
            var options = new ForwardedHeadersOptions
            {
                ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,

                // По умолчанию 1 — берётся только ПРАВЫЙ элемент цепочки, то есть ближайший
                // прокси (egress Netlify), а не клиент. Цепочка у нас двухзвенная
                // (Netlify -> front-end Azure), поэтому лимит снят: проходим её до конца и
                // получаем исходный адрес.
                ForwardLimit = null
            };

            // По умолчанию ASP.NET доверяет только loopback (KnownNetworks: 127.0.0.1/8, ::1/128),
            // поэтому за Azure заголовок молча игнорировался бы, и весь этот middleware был бы
            // no-op. Списки очищаются осознанно: единственный публичный вход — Netlify/Azure,
            // прямого доступа к бэкенду мимо прокси не предполагается.
            //
            // Плата за это: X-Forwarded-For подделывается любым, кто дотянется до бэкенда
            // напрямую. Значение используется только как справка (страна в дропдауне телефона)
            // и как аудит-поле (LoginHistory/RegisteredIp) — прав оно не выдаёт и решений
            // об авторизации не принимает.
            options.KnownNetworks.Clear();
            options.KnownProxies.Clear();

            return options;
        }

        protected override void ConfigureAdditionalMiddleware(IApplicationBuilder app)
        {
            app.UseAuthentication();

            // B7 (2026-08-06): между Authentication и Authorization — активность считается по
            // факту валидного токена, а не только по успешно пройденной ролевой проверке.
            app.UseMiddleware<UserActivityTrackingMiddleware>();

            app.UseAuthorization();
        }

        protected override IApiServiceRegistrarFactory GetServiceRegistrarFactory()
            => new DefaultApiServiceRegistrar();

        // Политика базового класса (AllowAnyOrigin) непригодна для auth: спецификация CORS
        // запрещает сочетать Allow-Origin: * с Allow-Credentials, а без credentials браузер
        // не пошлёт httpOnly-cookie с refresh-токеном — RefreshToken/Logout получали бы
        // пустую cookie, и тихое продление сессии ломалось бы уже локально
        // (фронт :5173 и API :5253 — разные origin, даже будучи оба на localhost).
        protected override CorsPolicyBuilder ConfigureCorPolicy(CorsPolicyBuilder corPolicyBuilder)
        {
            var allowedOrigins = CorsSettings.Instance.AllowedOrigins;

            // Ничего не настроено — оставляем поведение базового класса. Обратный выбор
            // (WithOrigins с пустым списком) заблокировал бы вообще все браузерные запросы,
            // включая публичный сайт; терять cookie-сессию при пустом конфиге дешевле,
            // чем положить весь API.
            if (allowedOrigins.Length == 0)
                return base.ConfigureCorPolicy(corPolicyBuilder);

            return corPolicyBuilder.WithOrigins(allowedOrigins)
                                   .AllowAnyMethod()
                                   .AllowAnyHeader()
                                   .AllowCredentials();
        }

        private static void ConfigureAuthentication(IServiceCollection services)
        {
            var jwtSettings = JwtSettings.Instance;

            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                    .AddJwtBearer(options =>
                    {
                        options.TokenValidationParameters = new TokenValidationParameters
                        {
                            ValidateIssuer = true,
                            ValidIssuer = jwtSettings.Issuer,
                            ValidateAudience = true,
                            ValidAudience = jwtSettings.Audience,
                            ValidateIssuerSigningKey = true,
                            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey)),
                            ValidateLifetime = true,
                            // По умолчанию 5 минут — просроченный access-токен так долго
                            // оставался бы рабочим, что обесценивало бы TTL в 15 минут.
                            ClockSkew = TimeSpan.FromSeconds(30),
                            RoleClaimType = ClaimTypes.Role,
                            NameClaimType = ClaimTypes.Name
                        };

                        // Мгновенный отзыв ОДНОЙ сессии (David, 2026-08-31): «Завершить сеанс» в
                        // «Активных сеансах» гасит refresh-токен в БД, но уже выпущенный
                        // access-токен — stateless JWT — прожил бы до 15 минут (AccessTokenMinutes)
                        // на устройстве, которое отозвали, полностью незамеченно. Проверка стоит
                        // здесь, а не только в permission-атрибутах (как IAccessTokenRevocationRegistry
                        // после impersonation, ADR 030): у обычного клиента их почти нигде нет, а
                        // «Активные сеансы» — клиентская фича, не admin-панель. Быстрый путь
                        // (`registry.IsEmpty`) держит цену для 99.9% запросов, где никто ничего не
                        // отзывал, нулевой — тот же приём, что уже используется для impersonation.
                        options.Events = new JwtBearerEvents
                        {
                            OnTokenValidated = context =>
                            {
                                var registry = context.HttpContext.RequestServices
                                    .GetRequiredService<ISessionRevocationRegistry>();

                                if (context.Principal?.IsSessionRevoked(registry) == true)
                                    context.Fail("Session has been revoked.");

                                return Task.CompletedTask;
                            }
                        };
                    });

            services.AddAuthorization();
        }
    }
}
