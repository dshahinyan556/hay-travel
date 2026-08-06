using ATTours.ClientAPI.DependencyInjection;
using ATTours.ClientAPI.Mapper.MappingProfile;
using ATTours.ClientAPI.Middleware;
using ATTours.Common.Settings;
using ATTours.DataLayer;
using ATTours.Helper.Interfaces;
using ATTours.Helper.MiddlewareAbstraction;
using ATTours.Helper.MvcRegistrars;
using ATTours.Helper.StartupAbstraction.ApiAbstraction;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;

namespace ATTours.ClientAPI
{
    public class Startup : StartupApiBase
    {
        public override void ConfigureServices(IServiceCollection services)
        {
            base.ConfigureServices(services);
            services.AddDAL();
            services.AddServices();
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
            app.UseMiddleware<InitializableMiddlewareBase<ATToursExceptionMaster>>();
            base.ConfigureFactory(app, env);
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
                    });

            services.AddAuthorization();
        }
    }
}
