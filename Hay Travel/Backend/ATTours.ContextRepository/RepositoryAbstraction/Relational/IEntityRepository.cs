using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryAbstraction.Relational
{
    public interface IEntityRepository<TEntity> : IEntityBaseBaseRepository<TEntity>
        where TEntity : class
    {
        Task AddRangeAsync(List<TEntity> logEvents, CancellationToken cancellationToken = default);
        void Update(TEntity entity);
        void UpdateEntryPropertyValue<TProperty>(TEntity entity, Expression<Func<TEntity, TProperty>> propertyExpression, TProperty currentValue);
        void UpdateRange(IEnumerable<TEntity> entities);
        void DeleteWhere(Expression<Func<TEntity, bool>> predicate);
        void Delete(TEntity entity);
        void DeleteRange(List<TEntity> entities);
        int SaveChanges();
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
        IEntityQueryableRepository<TEntity> AsQueryable();
        void AutoDetectChangesEnabled(bool detectChanges);
    }
}
