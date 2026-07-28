using ATTours.Helper.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.ServiceDescriptorConfigurators
{
    public class ControllerServiceConfigurator : IServiceDescriptorConfigurator
    {
        public virtual IMvcBuilder ConfigureServices(IServiceCollection services)
        {
            return services.AddControllers();
        }
    }
}
