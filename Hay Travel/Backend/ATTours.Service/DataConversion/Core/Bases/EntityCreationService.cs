using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.DataConversion.Core.Bases
{
    public class EntityCreationService<TEntity, TContextFactory> : EntityActionServiceBase<TEntity, TContextFactory>
        where TEntity : class, IEntity, new()
        where TContextFactory : IApplicationContextFactory, new()
    {
        public EntityCreationService(TEntity entity, string connectionString, CancellationToken cancellationToken = default)
            : base(entity, connectionString, cancellationToken)
        {
        }

        public EntityCreationService(List<TEntity> entities, string connectionString, CancellationToken cancellationToken = default)
            : base(entities, connectionString, cancellationToken)
        {
        }

        public EntityCreationService(TEntity entity, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entity, context, cancellationToken)
        {
        }

        public EntityCreationService(List<TEntity> entities, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entities, context, cancellationToken)
        {
        }

        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            await EntityRepository.AddRangeAsync(Entities);
        }
    }
}
