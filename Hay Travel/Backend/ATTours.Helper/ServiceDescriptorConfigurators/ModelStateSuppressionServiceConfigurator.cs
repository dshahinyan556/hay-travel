using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.ServiceDescriptorConfigurators
{
    public class ModelStateSuppressionServiceConfigurator : ControllerServiceConfigurator
    {
        public override IMvcBuilder ConfigureServices(IServiceCollection services)
        {
            var mvcBuilder = base.ConfigureServices(services);
            services.Configure<ApiBehaviorOptions>(options => { options.SuppressModelStateInvalidFilter = true; });

            return mvcBuilder;
        }
    }
}
