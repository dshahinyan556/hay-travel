using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.Interfaces
{
    public interface IMvcBuilderConfigurator
    {
        void ConfigureMvcBuilder(IMvcBuilder mvcBuilder);
    }
}
