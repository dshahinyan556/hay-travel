using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryAbstraction.Relational
{
    public interface IOrderedQueryableRepository<TEntity> : IQueryableRepository<TEntity>
    {
        IOrderedQueryableRepository<TEntity> ThenBy(Expression<Func<TEntity, object>> thenBy);
        IOrderedQueryableRepository<TEntity> ThenByDescending(Expression<Func<TEntity, object>> thenByDescending);
    }
}
