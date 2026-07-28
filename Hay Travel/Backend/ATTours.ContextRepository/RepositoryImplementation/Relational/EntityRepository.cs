using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryImplementation.Relational
{
    public class EntityRepository<TEntity> : EntityBaseRepository<TEntity>, IEntityRepository<TEntity>
        where TEntity : class
    {

        public EntityRepository(IApplicationDbContext context)
            : base(context)
        { }

        public IEntityQueryableRepository<TEntity> AsQueryable()
        {
            return new EntityQueryableRepository<TEntity>(Entities);
        }

        public async Task AddRangeAsync(List<TEntity> logEvents, CancellationToken cancellationToken = default)
        {
            await Entities.AddRangeAsync(logEvents, cancellationToken);
        }

        public void Delete(TEntity entity)
        {
            Context.Entry(entity).State = EntityState.Deleted;
        }

        public void DeleteRange(List<TEntity> entities)
        {
            Entities.RemoveRange(entities);
        }

        public void DeleteWhere(Expression<Func<TEntity, bool>> predicate)
        {
            var entities = Entities.Where(predicate);

            foreach (var entity in entities)
            {
                Context.Entry(entity).State = EntityState.Deleted;
            }
        }

        public void Update(TEntity entity)
        {
            Context.Entry(entity).State = EntityState.Modified;
        }

        public void UpdateEntryPropertyValue<TProperty>(TEntity entity, Expression<Func<TEntity, TProperty>> propertyExpression, TProperty currentValue)
        {
            Context.Entry(entity).Property(propertyExpression).CurrentValue = currentValue;
        }

        public void UpdateRange(IEnumerable<TEntity> entities)
        {
            Entities.UpdateRange(entities);
        }

        public int SaveChanges()
        {
            return Context.SaveChanges();
        }

        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await Context.SaveChangesAsync(cancellationToken);
        }

        public void AutoDetectChangesEnabled(bool detectChanges)
        {
            Context.ChangeTracker.AutoDetectChangesEnabled = detectChanges;
        }
    }
}
