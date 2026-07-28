using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace ATTours.DataLayer
{
    public abstract class RepositoryBase<TEntity> : IRepositoryBase<TEntity> where TEntity : EntityBase, new()
    {
        protected readonly ATToursContext _context;
        protected readonly DbSet<TEntity> _dbSet;

        public RepositoryBase(ATToursContext context)
        {
            _context = context;
            _dbSet = _context.Set<TEntity>();
        }
        public virtual async Task<TEntity> GetById(int id)
        {
            return await _dbSet.FindAsync(id);
        }
        public virtual async Task<IEnumerable<TEntity>> GetAll()
        {
            return _dbSet;
        }
        public virtual IEnumerable<TEntity> GetWithWhere(Expression<Func<TEntity, bool>> whereProperties)
        {
            return ApplyWhere(_dbSet, whereProperties).ToList();
        }
        public virtual IEnumerable<TEntity> GetWithInclude(params Expression<Func<TEntity, object>>[] includeProperties)
        {
            return ApplyInclude(_dbSet, includeProperties).ToList();
        }
        public virtual TEntity GetByIdWithInclude(int id, params Expression<Func<TEntity, object>>[] includeProperties)
        {
            return ApplyInclude(_dbSet, includeProperties).SingleOrDefault(x => x.Id == id);
        }
        public virtual async Task<TEntity> Add(TEntity entity)
        {
            await _dbSet.AddAsync(entity);
            await _context.SaveChangesAsync();
            return entity;
        }
        public virtual async Task<IEnumerable<TEntity>> AddRange(IEnumerable<TEntity> entities)
        {
            await _dbSet.AddRangeAsync(entities);
            await _context.SaveChangesAsync();
            return entities;
        }
        public virtual async Task<TEntity> Update(TEntity entity)
        {
            _dbSet.Entry(entity).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return entity;
        }
        public virtual async Task Delete(TEntity entity)
        {
            _dbSet.Remove(entity);
            await _context.SaveChangesAsync();
        }
        public virtual async Task DeleteWhere(Expression<Func<TEntity, bool>> whereProperties)
        {
            if (whereProperties != null)
            {
                var entities = _dbSet.Where(whereProperties);

                foreach (var entity in entities)
                {
                    _dbSet.Entry(entity).State = EntityState.Deleted;
                }
                await _context.SaveChangesAsync();
            }
        }
        public virtual IEnumerable<TEntity> GetWithIncludeWhere(Expression<Func<TEntity, bool>> whereProperties, params Expression<Func<TEntity, object>>[] includeProperties)
        {
            var result = ApplyInclude(_dbSet, includeProperties);
            result = ApplyWhere(result, whereProperties);
            return result.ToList();
        }
        private IQueryable<TEntity> ApplyInclude(IQueryable<TEntity> query, params Expression<Func<TEntity, object>>[] includeProperties)
        {
            foreach (var includeProperty in includeProperties)
            {
                query = query.Include(includeProperty);
            }
            return query;
        }
        private IQueryable<TEntity> ApplyWhere(IQueryable<TEntity> query, Expression<Func<TEntity, bool>> whereProperties)
        {
            if (whereProperties != null)
            {
                query = query.Where(whereProperties);
            }
            return query;
        }
    }
}
