using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryImplementation.Relational
{
    public class EntityBaseRepository<TEntity>(IApplicationDbContext context) : IEntityBaseBaseRepository<TEntity>
        where TEntity : class
    {
        protected IApplicationDbContext Context { get; } = context;
        protected DbSet<TEntity> Entities => Context.Set<TEntity>();

        public async Task AddAsync(TEntity entity, CancellationToken cancellationToken = default)
        {
            await Entities.AddAsync(entity, cancellationToken);
        }

        public async Task<List<TEntity>> ToListAsync(Expression<Func<TEntity, bool>> where, CancellationToken cancellationToken = default)
        {
            return await Entities.Where(where).ToListAsync(cancellationToken);
        }
    }
}
