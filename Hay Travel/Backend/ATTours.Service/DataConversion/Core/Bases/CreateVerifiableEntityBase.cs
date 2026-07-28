using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.DataConversion.Core.Bases
{
    public abstract class CreateVerifiableEntityBase<TEntity, TContextFactory> : EntityCreationService<TEntity, TContextFactory>
        where TEntity : class, IEntity, new()
        where TContextFactory : IApplicationContextFactory, new()
    {
        protected CreateVerifiableEntityBase(TEntity entity, string connectionString, CancellationToken cancellationToken = default) 
            : base(entity, connectionString, cancellationToken)
        {
        }

        protected CreateVerifiableEntityBase(List<TEntity> entities, string connectionString, CancellationToken cancellationToken = default) 
            : base(entities, connectionString, cancellationToken)
        {
        }

        protected CreateVerifiableEntityBase(TEntity entity, IApplicationDbContext context, CancellationToken cancellationToken = default) 
            : base(entity, context, cancellationToken)
        {
        }

        protected CreateVerifiableEntityBase(List<TEntity> entities, IApplicationDbContext context, CancellationToken cancellationToken = default) 
            : base(entities, context, cancellationToken)
        {
        }

        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            await GetEntityValidation().ValidateEntitiesAsync();
            await base.ExecuteEntityChangesFactoryAsync();
        }
        protected abstract IEntityValidation GetEntityValidation();
    }
}
