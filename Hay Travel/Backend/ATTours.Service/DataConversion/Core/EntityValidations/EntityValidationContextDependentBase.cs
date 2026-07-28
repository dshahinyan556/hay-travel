using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.ContextRepository;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.DataConversion.Core.EntityValidations
{
    public abstract class EntityValidationContextDependentBase<TEntity, TContextFactory> : CoreBase<TContextFactory> , IEntityValidation
        where TEntity : class, IEntity
        where TContextFactory : IApplicationContextFactory, new()
    {
        protected EntityValidationContextDependentBase(List<TEntity> entities, string connectionString)
            : base(connectionString)
        {
            Entities = entities;
        }

        protected EntityValidationContextDependentBase(List<TEntity> entities, IApplicationDbContext context)
            : base(context)
        {
            Entities = entities;
        }

        protected IReadOnlyList<TEntity> Entities { get; }

        public abstract Task ValidateEntitiesAsync();
    }
}
