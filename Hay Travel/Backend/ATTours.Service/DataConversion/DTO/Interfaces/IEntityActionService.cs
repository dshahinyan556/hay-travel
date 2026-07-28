using ATTours.Common.Infrastructure.Abstractions.Interfaces;

namespace ATTours.BusinessServices.DataConversion.DTO.Interfaces
{
    public interface IEntityBaseActionService<TEntity> : IEntityChangeExecutor
        where TEntity : class, IEntity, new()
    {
        public List<TEntity> Entities { get; }
    }
}
