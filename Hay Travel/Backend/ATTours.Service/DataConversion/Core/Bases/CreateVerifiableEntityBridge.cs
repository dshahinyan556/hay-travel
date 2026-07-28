using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.DataConversion.Core.Bases
{
    public class CreateVerifiableEntityBridge<TEntity, TContextFactory> : CreateVerifiableEntityBase<TEntity, TContextFactory>
        where TEntity : class, IEntity, new()
        where TContextFactory : IApplicationContextFactory, new()
    {
        public CreateVerifiableEntityBridge(TEntity entity, string connectionString,
                                            IEntityValidation entityValidation, CancellationToken cancellationToken = default)
            : base(entity, connectionString, cancellationToken)
        {
            EntityValidation = entityValidation;
        }

        public CreateVerifiableEntityBridge(List<TEntity> entities, string connectionString,
                                            IEntityValidation entityValidation, CancellationToken cancellationToken = default)
            : base(entities, connectionString, cancellationToken)
        {
            EntityValidation = entityValidation;
        }

        public CreateVerifiableEntityBridge(TEntity entity, IApplicationDbContext context,
                                            IEntityValidation entityValidation, CancellationToken cancellationToken = default)
            : base(entity, context, cancellationToken)
        {
            EntityValidation = entityValidation;
        }

        public CreateVerifiableEntityBridge(List<TEntity> entities, IApplicationDbContext context,
                                            IEntityValidation entityValidation, CancellationToken cancellationToken = default)
            : base(entities, context, cancellationToken)
        {
            EntityValidation = entityValidation;
        }

        protected IEntityValidation EntityValidation { get; }

        protected override IEntityValidation GetEntityValidation() => EntityValidation;
    }
}
