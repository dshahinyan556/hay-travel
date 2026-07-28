using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.StartupAbstraction.DescriptorBuilders
{
    public class ServiceDescriptorBuilder : IServiceDescriptorBuilder
    {
        private readonly Type serviceType;
        private readonly Type implementationType;
        private readonly ServiceLifetime lifetime;

        public ServiceDescriptorBuilder(Type serviceType, ServiceLifetime lifetime = ServiceLifetime.Scoped)
        {
            this.serviceType = serviceType;
            implementationType = serviceType;
            this.lifetime = lifetime;
        }

        public ServiceDescriptorBuilder(Type serviceType, Type implementationType, ServiceLifetime lifetime = ServiceLifetime.Scoped)
        {
            this.serviceType = serviceType;
            this.implementationType = implementationType;
            this.lifetime = lifetime;
        }

        public ServiceDescriptor CreateDescriptor()
        {
            return new ServiceDescriptor(serviceType, implementationType, lifetime);
        }
    }
}
