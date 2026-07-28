using ATTours.ClientAPI;
using ATTours.ClientAPI.Helper;

var builder = HostingHelper<Startup>.CreateHostBuilder(args);
await builder.Build().RunAsync();
