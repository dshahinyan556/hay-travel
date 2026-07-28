using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.ContextRepository;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.DataConversion.Core.Bases
{
    public abstract class EntityActionServiceBase<TEntity, TContextFactory> : RepositoryCoreBase<TEntity, TContextFactory>, IEntityBaseActionService<TEntity>
        where TEntity : class, IEntity, new()
        where TContextFactory : IApplicationContextFactory, new()
    {
        #region Constructors
        protected EntityActionServiceBase(TEntity entity, string connectionString, CancellationToken cancellationToken)
            : base(connectionString)
        {
            CancellationToken = cancellationToken;
            Entities = [entity];
        }
        protected EntityActionServiceBase(List<TEntity> entities, string connectionString, CancellationToken cancellationToken)
         : base(connectionString)
        {
            CancellationToken = cancellationToken;
            Entities = entities;
        }
        protected EntityActionServiceBase(TEntity entity, IApplicationDbContext context, CancellationToken cancellationToken)
            : base(context)
        {
            CancellationToken = cancellationToken;
            Entities = [entity];
        }

        protected EntityActionServiceBase(List<TEntity> entities, IApplicationDbContext context, CancellationToken cancellationToken)
           : base(context)
        {
            CancellationToken = cancellationToken;
            Entities = entities;
        }
        #endregion

        public List<TEntity> Entities { get; }
        protected CancellationToken CancellationToken { get; }


        public async Task ExecuteEntityChangesAsync()
        {
            await SaveEntityChangesAsync();
        }

        protected virtual async Task SaveEntityChangesAsync()
        {
            await ExecuteEntityChangesFactoryAsync();
            await EntityRepository.SaveChangesAsync(CancellationToken);
        }

        protected abstract Task ExecuteEntityChangesFactoryAsync();
    }
}
