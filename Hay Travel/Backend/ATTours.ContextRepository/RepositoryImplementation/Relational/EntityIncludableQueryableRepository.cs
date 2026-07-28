using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;
using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryImplementation.Relational
{
    internal class EntityIncludableQueryableRepository<TEntity, TPreviousProperty> : EntityQueryableRepository<TEntity>, IIncludableQueryableRepository<TEntity, TPreviousProperty>
        where TEntity : class
    {
        internal EntityIncludableQueryableRepository(IIncludableQueryable<TEntity, TPreviousProperty> queryable)
            : base(queryable)
        { }

        public IIncludableQueryableRepository<TEntity, TNextProperty> ThenInclude<TNextProperty>(Expression<Func<TPreviousProperty, TNextProperty>> include)
        {
            var orderedQuery = ((IIncludableQueryable<TEntity, TPreviousProperty>)LocalEntities).ThenInclude(include);
            return new EntityIncludableQueryableRepository<TEntity, TNextProperty>(orderedQuery);
        }

        public IIncludableQueryableRepository<TEntity, TNextProperty> ThenInclude<TNextProperty>(Expression<Func<TPreviousProperty, ICollection<TNextProperty>>> include)
        {
            var orderedQuery = ((IIncludableQueryable<TEntity, TPreviousProperty>)LocalEntities).ThenInclude(include);
            return new EntityIncludableCollectionQueryableRepository<TEntity, TNextProperty>(orderedQuery);
        }

        public IIncludableQueryableRepository<TEntity, TNextProperty> ThenInclude<TNextProperty>(Expression<Func<TPreviousProperty, IEnumerable<TNextProperty>>> include)
        {
            var orderedQuery = ((IIncludableQueryable<TEntity, TPreviousProperty>)LocalEntities).ThenInclude(include);
            return new EntityIncludableCollectionQueryableRepository<TEntity, TNextProperty>(orderedQuery);
        }

        public IIncludableQueryableRepository<TEntity, TNextProperty> ThenInclude<TNextProperty>(Expression<Func<TPreviousProperty, List<TNextProperty>>> include)
        {
            var orderedQuery = ((IIncludableQueryable<TEntity, TPreviousProperty>)LocalEntities).ThenInclude(include);
            return new EntityIncludableCollectionQueryableRepository<TEntity, TNextProperty>(orderedQuery);
        }
    }
}
