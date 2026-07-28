using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;

namespace ATTours.BusinessServices
{
    public abstract class ServiceBase<TEntity> : IServiceBase<TEntity> where TEntity : EntityBase, new()
    {
        protected readonly IRepositoryBase<TEntity> _repository;

        public ServiceBase(IRepositoryBase<TEntity> repository)
        {
            _repository = repository;
        }

        public virtual async Task<IEnumerable<TEntity>> GetAll()
        {
            return await _repository.GetAll();
        }

        public virtual async Task<TEntity> GetById(int id)
        {
            return await _repository.GetById(id);
        }

        public virtual async Task<TEntity> Add(TEntity entity)
        {
            return await _repository.Add(entity);
        }
        public virtual async Task<TEntity> Update(TEntity entity)
        {
            return await _repository.Update(entity);
        }

        public virtual async Task Delete(int id)
        {
            if (await _repository.GetById(id) is TEntity entity)
            {
                await _repository.Delete(entity);
            }
            else
            {
                throw new Exception();
            }
        }
    }
}
