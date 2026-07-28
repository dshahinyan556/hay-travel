using Microsoft.EntityFrameworkCore;

namespace ATTours.ContextRepository.ContextAbstraction
{
    public abstract class ApplicationContextFactoryBase<TContext> : IApplicationContextFactory
        where TContext : DbContext, IApplicationDbContext
    {
        public IApplicationDbContext CreateContext(string connectionString) => Activator.CreateInstance(typeof(TContext), [CreateContextOptionBuilder(connectionString).Options]) as TContext;

        public abstract DbContextOptionsBuilder CreateContextOptionBuilder(string connectionString);
    }
}
