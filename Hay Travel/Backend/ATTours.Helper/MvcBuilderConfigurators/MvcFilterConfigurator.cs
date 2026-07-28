using Microsoft.AspNetCore.Mvc;

namespace ATTours.Helper.MvcBuilderConfigurators
{
    public class MvcFilterConfigurator : DefaultMvcBuilderConfigurator
    {
        private readonly Type[] filters;

        public MvcFilterConfigurator(params Type[] filters)
        {
            this.filters = filters;
        }
        protected override void ConfigureMvcOptions(MvcOptions mvcOptions)
        {
            base.ConfigureMvcOptions(mvcOptions);
            foreach (var filter in filters)
                mvcOptions.Filters.Add(filter);
        }
    }
}
