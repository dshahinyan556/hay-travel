using ATTours.Helper.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.FormatterConfigurators
{
    public class XmlFormatterConfigurator : IMvcFormatterConfigurator
    {
        public void ConfigureFormatters(IMvcBuilder mvcBuilder)
        {
            mvcBuilder.AddXmlSerializerFormatters();
        }
    }
}
