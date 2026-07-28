using ATTours.Common.Dto;

namespace ATTours.Common.Infrastructure.Abstractions.Interfaces
{
    public interface IServiceBase<TEntity> where TEntity : EntityBase, new()
    {
        Task<TEntity> Add(TEntity entity);
        Task<TEntity> GetById(int id);
        Task<IEnumerable<TEntity>> GetAll();
        Task<TEntity> Update(TEntity entity);
        Task Delete(int id);
    }
}
