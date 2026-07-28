using ATTours.Helper.Interfaces;
using ATTours.Helper.MvcRegistrars;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace ATTours.Helper.StartupAbstraction.ApiAbstraction
{
    public abstract class StartupApiBase
    {
        public virtual void ConfigureServices(IServiceCollection services)
        {
            services.AddCors();
            services.AddSwaggerGen();
            var registrarFactory = GetServiceRegistrarFactory();
            var serviceRegistrarExecutor = new ApiServiceRegistrarExecutor(registrarFactory, services);
            serviceRegistrarExecutor.ExecuteServiceRegistrarFactory();
            services.AddEndpointsApiExplorer();
        }

        protected abstract IApiServiceRegistrarFactory GetServiceRegistrarFactory();

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            app.UseRouting();
            ConfigureFactory(app, env);
        }

        protected virtual void ConfigureFactory(IApplicationBuilder app, IWebHostEnvironment env)
        {
            app.UseCors(x => ConfigureCorPolicy(x));

            if (!env.IsProduction())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
            });
        }

        protected virtual CorsPolicyBuilder ConfigureCorPolicy(CorsPolicyBuilder corPolicyBuilder)
        {
            return corPolicyBuilder.AllowAnyOrigin()
                                   .AllowAnyMethod()
                                   .AllowAnyHeader();
        }
    }
}

