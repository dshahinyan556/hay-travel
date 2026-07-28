using ATTours.Helper.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.FormatterConfigurators
{
    public class DefaultJsonConfigurator : IMvcFormatterConfigurator
    {
        public void ConfigureFormatters(IMvcBuilder mvcBuilder)
        {
            mvcBuilder.AddJsonOptions(ConfigureJsonOptions);
        }

        protected virtual void ConfigureJsonOptions(JsonOptions jsonOptions)
        {
            jsonOptions.JsonSerializerOptions.AllowTrailingCommas = true;
            jsonOptions.JsonSerializerOptions.MaxDepth = 1000;
        }
    }
}
