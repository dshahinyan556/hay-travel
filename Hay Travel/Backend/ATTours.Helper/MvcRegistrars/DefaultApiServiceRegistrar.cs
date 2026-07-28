using ATTours.Helper.FormatterConfigurators;
using ATTours.Helper.Interfaces;
using ATTours.Helper.MvcBuilderConfigurators;
using ATTours.Helper.ServiceDescriptorConfigurators;

namespace ATTours.Helper.MvcRegistrars
{
    public class DefaultApiServiceRegistrar : IApiServiceRegistrarFactory
    {
        public IMvcBuilderConfigurator GetMvcBuilderConfigurator()
        {
            return new DefaultMvcBuilderConfigurator();
        }

        public IMvcFormatterConfigurator GetMvcFormatterConfigurator()
        {
            return new NewtonSoftJsonConfigurator();
        }

        public IServiceDescriptorConfigurator GetServiceDescriptorConfigurator()
        {
            return new ControllerServiceConfigurator();
        }
    }
}
