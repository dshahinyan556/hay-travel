using ATTours.ClientAPI.DependencyInjection;
using ATTours.ClientAPI.Mapper.MappingProfile;
using ATTours.ClientAPI.Middleware;
using ATTours.Common.Settings;
using ATTours.DataLayer;
using ATTours.Helper.Interfaces;
using ATTours.Helper.MiddlewareAbstraction;
using ATTours.Helper.MvcRegistrars;
using ATTours.Helper.StartupAbstraction.ApiAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.ClientAPI
{
    public class Startup : StartupApiBase
    {
        public override void ConfigureServices(IServiceCollection services)
        {
            base.ConfigureServices(services);
            services.AddDAL();
            services.AddServices();
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

        protected override IApiServiceRegistrarFactory GetServiceRegistrarFactory()
            => new DefaultApiServiceRegistrar();
    }
}
