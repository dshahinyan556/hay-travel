using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.ContextRepository.Extensions
{
    public static class MigrationExtensions
    {
        public static IServiceProvider MigrateDatabase<TContext>(this IServiceProvider serviceProvider)
            where TContext : DbContext, IApplicationDbContext
        {
            using (var scope = serviceProvider.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<TContext>();
                dbContext.Database.Migrate();
            }
            return serviceProvider;
        }
    }
}
