using ATTours.ContextRepository.Extensions;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryImplementation.Relational
{
    public class QueryableRepository<TEntity> : IQueryableRepository<TEntity>
    {
        protected IQueryable<TEntity> LocalEntities { get; set; }
        internal QueryableRepository(IQueryable<TEntity> query)
        {
            LocalEntities = query;
        }

        public IQueryableRepository<TEntity> Where(Expression<Func<TEntity, bool>> where)
        {
            LocalEntities = LocalEntities.Where(where);
            return this;
        }

        public IQueryableRepository<TEntity> Take(int count)
        {
            LocalEntities = LocalEntities.Take(count);
            return this;
        }

        public IQueryableRepository<TEntity> Skip(int count)
        {
            LocalEntities = LocalEntities.Skip(count);
            return this;
        }

        public IQueryableRepository<TResult> Join<TInner, TKey, TResult>(IQueryableRepository<TInner> inner, Expression<Func<TEntity, TKey>> outerKeySelector,
                                                                         Expression<Func<TInner, TKey>> innerKeySelector, Expression<Func<TEntity, TInner, TResult>> resultSelector)
        {
            var joinedEntities = LocalEntities.Join(inner.AsOrThrow<QueryableRepository<TInner>>().LocalEntities,
                                                    outerKeySelector, innerKeySelector, resultSelector);
            return new QueryableRepository<TResult>(joinedEntities);
        }

        public IQueryableRepository<TResult> GroupJoin<TInner, TKey, TResult>(IQueryableRepository<TInner> inner, Expression<Func<TEntity, TKey>> outerKeySelector,
                                                                              Expression<Func<TInner, TKey>> innerKeySelector, Expression<Func<TEntity, IEnumerable<TInner>, TResult>> resultSelector)
        {
            var joinedEntities = LocalEntities.GroupJoin(inner.AsOrThrow<QueryableRepository<TInner>>().LocalEntities,
                                                         outerKeySelector, innerKeySelector, resultSelector);
            return new QueryableRepository<TResult>(joinedEntities);
        }

        public IQueryableRepository<TResult> Join<TInner, TKey, TResult>(IQueryableRepository<TInner> inner, Expression<Func<TEntity, TKey>> outerKeySelector,
                                                                         Expression<Func<TInner, TKey>> innerKeySelector, Expression<Func<TEntity, TInner, TResult>> resultSelector,
                                                                         IEqualityComparer<TKey> comparer)
        {
            var joinedEntities = LocalEntities.Join(inner.AsOrThrow<QueryableRepository<TInner>>().LocalEntities,
                                                    outerKeySelector, innerKeySelector, resultSelector, comparer);
            return new QueryableRepository<TResult>(joinedEntities);
        }

        public IQueryableRepository<TResult> GroupJoin<TInner, TKey, TResult>(IQueryableRepository<TInner> inner, Expression<Func<TEntity, TKey>> outerKeySelector,
                                                                              Expression<Func<TInner, TKey>> innerKeySelector, Expression<Func<TEntity, IEnumerable<TInner>, TResult>> resultSelector,
                                                                              IEqualityComparer<TKey> comparer)
        {
            var joinedEntities = LocalEntities.GroupJoin(inner.AsOrThrow<QueryableRepository<TInner>>().LocalEntities,
                                                         outerKeySelector, innerKeySelector, resultSelector, comparer);
            return new QueryableRepository<TResult>(joinedEntities);
        }

        public IQueryableRepository<TResult> Select<TResult>(Expression<Func<TEntity, TResult>> selector)
        {
            var projectedEntities = LocalEntities.Select(selector);
            return new QueryableRepository<TResult>(projectedEntities);
        }

        public IQueryableRepository<TResult> SelectMany<TResult>(Expression<Func<TEntity, IEnumerable<TResult>>> selector)
        {
            var projectedEntities = LocalEntities.SelectMany(selector);
            return new QueryableRepository<TResult>(projectedEntities);
        }

        public IOrderedQueryableRepository<TEntity> OrderBy(Expression<Func<TEntity, object>> orderBy)
        {
            return new OrderedQueryableRepository<TEntity>(LocalEntities.OrderBy(orderBy));
        }

        public IOrderedQueryableRepository<TEntity> OrderByDescending(Expression<Func<TEntity, object>> orderBy)
        {
            return new OrderedQueryableRepository<TEntity>(LocalEntities.OrderByDescending(orderBy));
        }

        #region Executing methods

        #region Async methods
        public async Task<int> CountAsync(CancellationToken cancellationToken = default)
        {
            return await LocalEntities.CountAsync(cancellationToken);
        }

        public async Task<bool> AnyAsync(CancellationToken cancellationToken = default)
        {
            return await LocalEntities.AnyAsync(cancellationToken);
        }

        public async Task<bool> AnyAsync(Expression<Func<TEntity, bool>> where, CancellationToken cancellationToken = default)
        {
            return await LocalEntities.AnyAsync(where, cancellationToken);
        }

        public async Task<List<TEntity>> ToListAsync(CancellationToken cancellationToken = default)
        {
            return await LocalEntities.ToListAsync(cancellationToken);
        }

        public async Task<List<TResult>> ToListAsync<TResult>(Expression<Func<TEntity, TResult>> selector, CancellationToken cancellationToken = default)
        {
            return await LocalEntities.Select(selector).ToListAsync(cancellationToken);
        }

        public Task<TEntity> SingleOrDefaultAsync(CancellationToken cancellationToken = default)
        {
            return LocalEntities.SingleOrDefaultAsync(cancellationToken);
        }
        public Task<TEntity> SingleOrDefaultAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default)
        {
            return LocalEntities.SingleOrDefaultAsync(predicate, cancellationToken);
        }

        public async Task<TEntity> SingleAsync(CancellationToken cancellationToken = default)
        {
            return await LocalEntities.SingleAsync(cancellationToken);
        }

        public async Task<TEntity> SingleAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default)
        {
            return await LocalEntities.SingleAsync(predicate, cancellationToken);
        }

        public async Task<TEntity> FirstOrDefaultAsync(CancellationToken cancellationToken = default)
        {
            return await LocalEntities.FirstOrDefaultAsync(cancellationToken);
        }

        public async Task<TEntity> FirstOrDefaultAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default)
        {
            return await LocalEntities.FirstOrDefaultAsync(predicate, cancellationToken);
        }

        public async Task<TEntity> FirstAsync(CancellationToken cancellationToken = default)
        {
            return await LocalEntities.FirstAsync(cancellationToken);
        }

        public async Task<TEntity> FirstAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default)
        {
            return await LocalEntities.FirstAsync(predicate, cancellationToken);
        }

        #endregion

        #region Sync methods

        public int Count()
        {
            return LocalEntities.Count();
        }

        public bool Any()
        {
            return LocalEntities.Any();
        }

        public bool Any(Expression<Func<TEntity, bool>> where)
        {
            return LocalEntities.Any(where);
        }

        public List<TEntity> ToList()
        {
            return [.. LocalEntities];
        }

        public List<TResult> ToList<TResult>(Expression<Func<TEntity, TResult>> selector)
        {
            return [.. LocalEntities.Select(selector)];
        }

        public TEntity SingleOrDefault()
        {
            return LocalEntities.SingleOrDefault();
        }

        public TEntity SingleOrDefault(Expression<Func<TEntity, bool>> predicate)
        {
            return LocalEntities.SingleOrDefault(predicate);
        }

        public TEntity Single()
        {
            return LocalEntities.Single();
        }


        public TEntity Single(Expression<Func<TEntity, bool>> predicate)
        {
            return LocalEntities.Single(predicate);
        }

        public TEntity FirstOrDefault()
        {
            return LocalEntities.FirstOrDefault();
        }

        public TEntity FirstOrDefault(Expression<Func<TEntity, bool>> predicate)
        {
            return LocalEntities.FirstOrDefault(predicate);
        }

        public TEntity First()
        {
            return LocalEntities.First();
        }

        public TEntity First(Expression<Func<TEntity, bool>> predicate)
        {
            return LocalEntities.First(predicate);
        }

        #endregion

        #endregion
    }
}
