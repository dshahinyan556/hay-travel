using ATTours.Helper.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.MvcRegistrars
{
    public class ApiServiceRegistrarExecutor : IServiceRegistrarFactoryExecutor
    {
        private readonly IApiServiceRegistrarFactory serviceRegistrarFactory;
        private readonly IServiceCollection services;

        public ApiServiceRegistrarExecutor(IApiServiceRegistrarFactory serviceRegistrarFactory, IServiceCollection services)
        {
            this.serviceRegistrarFactory = serviceRegistrarFactory;
            this.services = services;
        }

        public void ExecuteServiceRegistrarFactory()
        {
            var serviceConfigurator = serviceRegistrarFactory.GetServiceDescriptorConfigurator();
            var mvcBuilder = serviceConfigurator.ConfigureServices(services);

            var mvcBuilderConfigurator = serviceRegistrarFactory.GetMvcBuilderConfigurator();
            mvcBuilderConfigurator.ConfigureMvcBuilder(mvcBuilder);

            var mvcFormatterConfigurator = serviceRegistrarFactory.GetMvcFormatterConfigurator();
            mvcFormatterConfigurator.ConfigureFormatters(mvcBuilder);
        }
    }
}
