using ATTours.Helper.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.Helper.MvcBuilderConfigurators
{
    public class MvcBuilderConfigurationCompositor : IMvcBuilderConfigurator
    {
        private readonly List<IMvcBuilderConfigurator> builderConfigurators;

        public MvcBuilderConfigurationCompositor(List<IMvcBuilderConfigurator> builderConfigurators)
        {
            this.builderConfigurators = builderConfigurators;
        }

        public void ConfigureMvcBuilder(IMvcBuilder mvcBuilder)
        {
            foreach (var builderConfigurator in builderConfigurators)
                builderConfigurator.ConfigureMvcBuilder(mvcBuilder);
        }
    }
}
