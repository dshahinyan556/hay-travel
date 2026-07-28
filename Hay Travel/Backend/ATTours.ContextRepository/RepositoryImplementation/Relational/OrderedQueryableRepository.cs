using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryImplementation.Relational
{
    public class OrderedQueryableRepository<TEntity> : QueryableRepository<TEntity>, IOrderedQueryableRepository<TEntity>
    {
        internal OrderedQueryableRepository(IOrderedQueryable<TEntity> query)
            : base(query) { }

        public IOrderedQueryableRepository<TEntity> ThenBy(Expression<Func<TEntity, object>> thenBy)
        {
            ((IOrderedQueryable<TEntity>)LocalEntities).ThenBy(thenBy);
            return this;
        }

        public IOrderedQueryableRepository<TEntity> ThenByDescending(Expression<Func<TEntity, object>> thenByDescending)
        {
            ((IOrderedQueryable<TEntity>)LocalEntities).ThenByDescending(thenByDescending);
            return this;
        }
    }
}
