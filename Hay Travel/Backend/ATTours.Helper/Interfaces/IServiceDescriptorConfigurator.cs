using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.Interfaces
{
    public interface IServiceDescriptorConfigurator
    {
        IMvcBuilder ConfigureServices(IServiceCollection services);
    }
}
