using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryAbstraction.Relational
{
    public interface IEntityQueryableRepository<TEntity> : IQueryableRepository<TEntity>
        where TEntity : class
    {
        IEntityQueryableRepository<TEntity> AsNoTracking();
        // EF Core "split query": issues one SQL statement per collection Include instead of a
        // single JOINed query. A query graph with several sibling collections (e.g. a tour's
        // days, translations, notes, tags all Included off the same root) otherwise multiplies
        // rows across every combination (cartesian explosion) — harmless with few rows per
        // collection, catastrophic once one of them grows (see TourGraphQueryExtensions).
        IEntityQueryableRepository<TEntity> AsSplitQuery();
        IIncludableQueryableRepository<TEntity, TNextProperty> Include<TNextProperty>(Expression<Func<TEntity, TNextProperty>> include);
        IIncludableQueryableRepository<TEntity, TNextProperty> Include<TNextProperty>(Expression<Func<TEntity, ICollection<TNextProperty>>> include);
        IIncludableQueryableRepository<TEntity, TNextProperty> Include<TNextProperty>(Expression<Func<TEntity, IEnumerable<TNextProperty>>> include);
        IIncludableQueryableRepository<TEntity, TNextProperty> Include<TNextProperty>(Expression<Func<TEntity, List<TNextProperty>>> include);
    }
}
