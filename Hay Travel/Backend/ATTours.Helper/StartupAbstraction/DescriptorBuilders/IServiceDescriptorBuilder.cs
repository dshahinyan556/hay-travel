using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.StartupAbstraction.DescriptorBuilders
{
    public interface IServiceDescriptorBuilder
    {
        public ServiceDescriptor CreateDescriptor();
    }
}
