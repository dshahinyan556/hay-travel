using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using Microsoft.EntityFrameworkCore;

using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryImplementation.Relational
{
    public class EntityQueryableRepository<TEntity> : QueryableRepository<TEntity>, IEntityQueryableRepository<TEntity>
           where TEntity : class
    {
        public EntityQueryableRepository(IQueryable<TEntity> queryable)
            : base(queryable)
        { }

        public IEntityQueryableRepository<TEntity> AsNoTracking()
        {
            LocalEntities = LocalEntities.AsNoTracking();
            return this;
        }

        public IEntityQueryableRepository<TEntity> AsSplitQuery()
        {
            LocalEntities = LocalEntities.AsSplitQuery();
            return this;
        }

        public IIncludableQueryableRepository<TEntity, TProperty> Include<TProperty>(Expression<Func<TEntity, TProperty>> include)
        {
            return new EntityIncludableQueryableRepository<TEntity, TProperty>(LocalEntities.Include(include));
        }

        public IIncludableQueryableRepository<TEntity, TProperty> Include<TProperty>(Expression<Func<TEntity, ICollection<TProperty>>> include)
        {
            return new EntityIncludableCollectionQueryableRepository<TEntity, TProperty>(LocalEntities.Include(include));
        }

        public IIncludableQueryableRepository<TEntity, TProperty> Include<TProperty>(Expression<Func<TEntity, IEnumerable<TProperty>>> include)
        {
            return new EntityIncludableCollectionQueryableRepository<TEntity, TProperty>(LocalEntities.Include(include));
        }

        public IIncludableQueryableRepository<TEntity, TProperty> Include<TProperty>(Expression<Func<TEntity, List<TProperty>>> include)
        {
            return new EntityIncludableCollectionQueryableRepository<TEntity, TProperty>(LocalEntities.Include(include));
        }
    }

}
