using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.Interfaces
{
    public interface IMvcFormatterConfigurator
    {
        void ConfigureFormatters(IMvcBuilder  mvcBuilder);
    }
}
