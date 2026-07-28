using ATTours.Helper.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.MvcBuilderConfigurators
{
    public class DefaultMvcBuilderConfigurator : IMvcBuilderConfigurator
    {
        public virtual void ConfigureMvcBuilder(IMvcBuilder mvcBuilder)
        {
            mvcBuilder.AddMvcOptions(ConfigureMvcOptions);
        }

        protected virtual void ConfigureMvcOptions(MvcOptions mvcOptions)
        {
            
        }
    }
}
