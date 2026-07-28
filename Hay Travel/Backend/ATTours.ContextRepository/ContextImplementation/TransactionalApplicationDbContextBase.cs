using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace ATTours.ContextRepository.ContextImplementation
{
    public abstract class TransactionalApplicationDbContextBase : DbContext, IApplicationDbContext
    {
        protected TransactionalApplicationDbContextBase()
        {
        }

        protected TransactionalApplicationDbContextBase(DbContextOptions options)
            : base(options)
        {
        }
        public IContextTransaction BeginTransaction()
        {
            return new ApplicationDbContextTransaction(Database.BeginTransaction());
        }

        public IContextTransaction BeginTransaction(IsolationLevel isolationLevel)
        {
            return new ApplicationDbContextTransaction(Database.BeginTransaction(isolationLevel));
        }

        public async Task<IContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
        {
            return new ApplicationDbContextTransaction(await Database.BeginTransactionAsync(cancellationToken));
        }

        public async Task<IContextTransaction> BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken cancellationToken = default)
        {
            return new ApplicationDbContextTransaction(await Database.BeginTransactionAsync(isolationLevel, cancellationToken));
        }
    }
}
