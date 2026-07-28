using ATTours.Helper.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;

namespace ATTours.Helper.FormatterConfigurators
{
    public class NewtonSoftJsonConfigurator : IMvcFormatterConfigurator
    {
        public void ConfigureFormatters(IMvcBuilder mvcBuilder)
        {
            mvcBuilder.AddNewtonsoftJson(ConfigureJsonOptions);
        }

        protected virtual void ConfigureJsonOptions(MvcNewtonsoftJsonOptions jsonOptions)
        {
            jsonOptions.SerializerSettings.ContractResolver = new Newtonsoft.Json.Serialization.CamelCasePropertyNamesContractResolver();
            jsonOptions.SerializerSettings.MissingMemberHandling = MissingMemberHandling.Error;
        }
    }
}
