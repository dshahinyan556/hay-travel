using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.ContextImplementation;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace ATTours.DataLayer
{
    public partial class ATToursContext : IApplicationDbContext
    {
        public IContextTransaction BeginTransaction()
        {
            return new ApplicationDbContextTransaction(Database.BeginTransaction());
        }

        public IContextTransaction BeginTransaction(IsolationLevel isolationLevel)
        {
            return new ApplicationDbContextTransaction(Database.BeginTransaction(isolationLevel));
        }

        public async Task<IContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default(CancellationToken))
        {
            return new ApplicationDbContextTransaction(await Database.BeginTransactionAsync(cancellationToken));
        }

        public async Task<IContextTransaction> BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken cancellationToken = default(CancellationToken))
        {
            return new ApplicationDbContextTransaction(await Database.BeginTransactionAsync(isolationLevel, cancellationToken));
        }
    }
}
