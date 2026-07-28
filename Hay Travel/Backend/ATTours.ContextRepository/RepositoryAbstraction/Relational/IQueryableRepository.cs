using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryAbstraction.Relational
{
    public interface IQueryableRepository<TEntity>
    {
        IQueryableRepository<TResult> Select<TResult>(Expression<Func<TEntity, TResult>> selector);
        IQueryableRepository<TResult> SelectMany<TResult>(Expression<Func<TEntity, IEnumerable<TResult>>> selector);
        IQueryableRepository<TEntity> Take(int count);
        IQueryableRepository<TEntity> Skip(int count);
        IQueryableRepository<TResult> Join<TInner, TKey, TResult>(IQueryableRepository<TInner> inner, Expression<Func<TEntity, TKey>> outerKeySelector,
                                                                  Expression<Func<TInner, TKey>> innerKeySelector, Expression<Func<TEntity, TInner, TResult>> resultSelector);
        IQueryableRepository<TResult> GroupJoin<TInner, TKey, TResult>(IQueryableRepository<TInner> inner, Expression<Func<TEntity, TKey>> outerKeySelector,
                                                                       Expression<Func<TInner, TKey>> innerKeySelector, Expression<Func<TEntity, IEnumerable<TInner>, TResult>> resultSelector);
        IQueryableRepository<TResult> Join<TInner, TKey, TResult>(IQueryableRepository<TInner> inner, Expression<Func<TEntity, TKey>> outerKeySelector,
                                                                  Expression<Func<TInner, TKey>> innerKeySelector, Expression<Func<TEntity, TInner, TResult>> resultSelector,
                                                                  IEqualityComparer<TKey> comparer);
        IQueryableRepository<TResult> GroupJoin<TInner, TKey, TResult>(IQueryableRepository<TInner> inner, Expression<Func<TEntity, TKey>> outerKeySelector,
                                                                       Expression<Func<TInner, TKey>> innerKeySelector, Expression<Func<TEntity, IEnumerable<TInner>, TResult>> resultSelector,
                                                                       IEqualityComparer<TKey> comparer);
        IQueryableRepository<TEntity> Where(Expression<Func<TEntity, bool>> where);
        IOrderedQueryableRepository<TEntity> OrderBy(Expression<Func<TEntity, object>> orderBy);
        IOrderedQueryableRepository<TEntity> OrderByDescending(Expression<Func<TEntity, object>> orderBy);
        #region Executing methods

        #region Async methods

        Task<int> CountAsync(CancellationToken cancellationToken = default);
        Task<bool> AnyAsync(CancellationToken cancellationToken = default);
        Task<bool> AnyAsync(Expression<Func<TEntity, bool>> where, CancellationToken cancellationToken = default);
        Task<List<TEntity>> ToListAsync(CancellationToken cancellationToken = default);
        Task<TEntity> SingleOrDefaultAsync(CancellationToken cancellationToken = default);
        Task<TEntity> SingleOrDefaultAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default);
        Task<TEntity> SingleAsync(CancellationToken cancellationToken = default);
        Task<TEntity> SingleAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default);
        Task<TEntity> FirstOrDefaultAsync(CancellationToken cancellationToken = default);
        Task<TEntity> FirstOrDefaultAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default);
        Task<TEntity> FirstAsync(CancellationToken cancellationToken = default);
        Task<TEntity> FirstAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default);

        #endregion

        #region Sync methods

        int Count();
        bool Any();
        bool Any(Expression<Func<TEntity, bool>> where);
        List<TEntity> ToList();
        TEntity SingleOrDefault();
        TEntity SingleOrDefault(Expression<Func<TEntity, bool>> predicate);
        TEntity Single();
        TEntity Single(Expression<Func<TEntity, bool>> predicate);
        TEntity FirstOrDefault();
        TEntity FirstOrDefault(Expression<Func<TEntity, bool>> predicate);
        TEntity First();
        TEntity First(Expression<Func<TEntity, bool>> predicate);

        #endregion

        #endregion
    }
}
