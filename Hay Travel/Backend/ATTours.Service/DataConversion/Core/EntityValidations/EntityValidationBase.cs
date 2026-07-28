using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;

namespace ATTours.BusinessServices.DataConversion.Core.EntityValidations
{
    public abstract class EntityValidationBase<TEntity>(List<TEntity> entities) : IEntityValidation
         where TEntity : class, IEntity
    {
        protected IReadOnlyList<TEntity> Entities { get; } = entities;

        public abstract Task ValidateEntitiesAsync();
    }
}
