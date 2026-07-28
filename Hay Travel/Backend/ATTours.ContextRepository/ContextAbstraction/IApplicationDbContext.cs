using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using System.Data;

namespace ATTours.ContextRepository.ContextAbstraction
{
    public interface IApplicationDbContext : IDisposable, IAsyncDisposable
    {
        DbSet<TEntity> Set<TEntity>() where TEntity : class;
        EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;
        int SaveChanges();
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
        IContextTransaction BeginTransaction();
        IContextTransaction BeginTransaction(IsolationLevel isolationLevel);
        Task<IContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);
        Task<IContextTransaction> BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken cancellationToken = default);
        ChangeTracker ChangeTracker { get; }
    }
}