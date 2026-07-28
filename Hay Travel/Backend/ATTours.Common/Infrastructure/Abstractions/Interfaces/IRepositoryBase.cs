using System.Linq.Expressions;

namespace ATTours.Common.Infrastructure.Abstractions.Interfaces
{
    public interface IRepositoryBase<TEntity> where TEntity : EntityBase, new()
    {
        Task<TEntity> GetById(int id);
        TEntity GetByIdWithInclude(int id, params Expression<Func<TEntity, object>>[] includeProperties);
        IEnumerable<TEntity> GetWithWhere(Expression<Func<TEntity, bool>> whereProperties);
        IEnumerable<TEntity> GetWithInclude(params Expression<Func<TEntity, object>>[] includeProperties);
        IEnumerable<TEntity> GetWithIncludeWhere(Expression<Func<TEntity, bool>> whereProperties, params Expression<Func<TEntity, object>>[] includeProperties);
        Task<IEnumerable<TEntity>> GetAll();
        Task<TEntity> Add(TEntity entity);
        Task<IEnumerable<TEntity>> AddRange(IEnumerable<TEntity> entities);
        Task<TEntity> Update(TEntity entity);
        Task Delete(TEntity entity);
        Task DeleteWhere(Expression<Func<TEntity, bool>> whereProperties);
    }
}
