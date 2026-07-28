using ATTours.Helper.Filter;
using ATTours.Helper.FormatterConfigurators;
using ATTours.Helper.Interfaces;
using ATTours.Helper.MvcBuilderConfigurators;
using ATTours.Helper.ServiceDescriptorConfigurators;

namespace ATTours.Helper.MvcRegistrars
{
    public class ValidatedApiServiceRegistrar<TFilter> : IApiServiceRegistrarFactory
        where TFilter : FieldValidationActionFilter
    {
        public IMvcBuilderConfigurator GetMvcBuilderConfigurator()
        {
            return new MvcFilterConfigurator(typeof(TFilter));
        }

        public IMvcFormatterConfigurator GetMvcFormatterConfigurator()
        {
            return new NewtonSoftJsonConfigurator();
        }

        public IServiceDescriptorConfigurator GetServiceDescriptorConfigurator()
        {
            return new ModelStateSuppressionServiceConfigurator();
        }
    }
}
