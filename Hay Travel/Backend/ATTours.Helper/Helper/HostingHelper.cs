using ATTours.Helper.StartupAbstraction.ApiAbstraction;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace ATTours.ClientAPI.Helper
{
    public static class HostingHelper<TStartup>
        where TStartup : StartupApiBase
    {
        public static IHostBuilder CreateHostBuilder(string[] args) 
        {
            return Host.CreateDefaultBuilder(args)
                       .ConfigureWebHostDefaults(webBuilder => { webBuilder.UseStartup<TStartup>(); });
        }
    }
}
