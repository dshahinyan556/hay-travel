using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryAbstraction.Relational
{
    public interface IIncludableQueryableRepository<TEntity, TPreviousProperty> : IEntityQueryableRepository<TEntity>
        where TEntity : class
    {
        IIncludableQueryableRepository<TEntity, TNextProperty> ThenInclude<TNextProperty>(Expression<Func<TPreviousProperty, TNextProperty>> include);
        IIncludableQueryableRepository<TEntity, TNextProperty> ThenInclude<TNextProperty>(Expression<Func<TPreviousProperty, ICollection<TNextProperty>>> include);
        IIncludableQueryableRepository<TEntity, TNextProperty> ThenInclude<TNextProperty>(Expression<Func<TPreviousProperty, IEnumerable<TNextProperty>>> include);
        IIncludableQueryableRepository<TEntity, TNextProperty> ThenInclude<TNextProperty>(Expression<Func<TPreviousProperty, List<TNextProperty>>> include);
    }
}
