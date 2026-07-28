using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryAbstraction.Relational
{
    public interface IEntityBaseBaseRepository<TEntity>
        where TEntity : class
    {
        Task AddAsync(TEntity entity, CancellationToken cancellationToken = default);
        Task<List<TEntity>> ToListAsync(Expression<Func<TEntity, bool>> where, CancellationToken cancellationToken = default);
    }
}
