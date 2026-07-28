using ATTours.Helper.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.FormatterConfigurators
{
    public class FormatterConfigurationCompositor : IMvcFormatterConfigurator
    {
        private readonly List<IMvcFormatterConfigurator> formatterConfigurators;

        public FormatterConfigurationCompositor(List<IMvcFormatterConfigurator> formatterConfigurators)
        {
            this.formatterConfigurators = formatterConfigurators;
        }

        public void ConfigureFormatters(IMvcBuilder mvcBuilder)
        {
            foreach (var configurator in formatterConfigurators)
                configurator.ConfigureFormatters(mvcBuilder);
        }
    }
}
