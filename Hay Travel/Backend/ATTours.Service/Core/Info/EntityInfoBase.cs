using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using System.Linq.Expressions;

namespace ATTours.BusinessServices.Core.Info
{
    public class EntityInfoBase<TEntity> : TourRepositoryCoreBase<TEntity>, IEntityInfoBase<TEntity>
        where TEntity : class
    {
        private readonly CancellationToken cancellationToken;
        public EntityInfoBase(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public EntityInfoBase(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context)
        {
            this.cancellationToken = cancellationToken;
        }

        public virtual async Task<List<TEntity>> GetAllAsync()
        {
            return await GetQueryableRepository().ToListAsync(cancellationToken);
        }
        public virtual async Task<List<TEntity>> GetAllAsync(Expression<Func<TEntity, bool>> where)
        {
            return await GetQueryableRepository(where).ToListAsync(cancellationToken);
        }
        protected virtual IQueryableRepository<TEntity> GetQueryableRepository(Expression<Func<TEntity, bool>> where = null)
            => where != null ? GetEntityQueryableRepository().Where(where) 
                             : GetEntityQueryableRepository();
        protected virtual IEntityQueryableRepository<TEntity> GetEntityQueryableRepository() => EntityRepository.AsQueryable().AsNoTracking();
    }
}
