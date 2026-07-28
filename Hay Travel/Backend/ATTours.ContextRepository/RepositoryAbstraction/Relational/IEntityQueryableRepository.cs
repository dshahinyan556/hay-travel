using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryAbstraction.Relational
{
    public interface IEntityQueryableRepository<TEntity> : IQueryableRepository<TEntity>
        where TEntity : class
    {
        IEntityQueryableRepository<TEntity> AsNoTracking();
        IIncludableQueryableRepository<TEntity, TNextProperty> Include<TNextProperty>(Expression<Func<TEntity, TNextProperty>> include);
        IIncludableQueryableRepository<TEntity, TNextProperty> Include<TNextProperty>(Expression<Func<TEntity, ICollection<TNextProperty>>> include);
        IIncludableQueryableRepository<TEntity, TNextProperty> Include<TNextProperty>(Expression<Func<TEntity, IEnumerable<TNextProperty>>> include);
        IIncludableQueryableRepository<TEntity, TNextProperty> Include<TNextProperty>(Expression<Func<TEntity, List<TNextProperty>>> include);
    }
}
