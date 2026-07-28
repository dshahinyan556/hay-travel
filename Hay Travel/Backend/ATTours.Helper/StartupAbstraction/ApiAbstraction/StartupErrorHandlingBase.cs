using ATTours.Helper.MiddlewareAbstraction;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.StartupAbstraction.ApiAbstraction
{
    public abstract class StartupErrorHandlingBase<TErrorMiddleware> : StartupApiBase
        where TErrorMiddleware : IErrorHandlingMiddleware
    {
        public override void ConfigureServices(IServiceCollection services)
        {
            base.ConfigureServices(services);
        }

        protected override void ConfigureFactory(IApplicationBuilder app, IWebHostEnvironment env)
        {
            app.UseMiddleware<TErrorMiddleware>();
            base.ConfigureFactory(app, env);
        }
    }
}
