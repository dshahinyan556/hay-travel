using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace ATTours.Helper.StartupAbstraction.DescriptorBuilders
{
    public class HostedServiceDescriptorBuilder(Type hostedServiceType) : IServiceDescriptorBuilder
    {
        public ServiceDescriptor CreateDescriptor()
        {
            return ServiceDescriptor.Singleton(typeof(IHostedService), hostedServiceType);
        }
    }
}
