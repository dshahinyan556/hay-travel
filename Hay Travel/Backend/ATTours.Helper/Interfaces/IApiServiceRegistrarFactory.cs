namespace ATTours.Helper.Interfaces
{
    public interface IApiServiceRegistrarFactory
    {
        IServiceDescriptorConfigurator GetServiceDescriptorConfigurator();

        IMvcBuilderConfigurator GetMvcBuilderConfigurator();

        IMvcFormatterConfigurator GetMvcFormatterConfigurator();
    }
}
