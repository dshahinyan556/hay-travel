using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore.Storage;

namespace ATTours.ContextRepository.ContextImplementation
{
    public class ApplicationDbContextTransaction : IContextTransaction
    {
        private readonly IDbContextTransaction dbContextTransaction;

        public ApplicationDbContextTransaction(IDbContextTransaction dbContextTransaction)
        {
            this.dbContextTransaction = dbContextTransaction;
        }

        public void Commit()
        {
            dbContextTransaction.Commit();
        }

        public async Task CommitAsync(CancellationToken cancellationToken = default)
        {
            await dbContextTransaction.CommitAsync(cancellationToken);
        }

        #region Dispose


        public void Dispose()
        {
            Dispose(disposing: true);
            GC.SuppressFinalize(this);
        }

        private bool disposedValue;
        protected virtual void Dispose(bool disposing)
        {
            if (!disposedValue)
            {
                if (disposing)
                {
                    dbContextTransaction?.Dispose();
                }
                disposedValue = true;
            }
        }

        public async ValueTask DisposeAsync()
        {
            await DisposeAsync(disposing: true);
            GC.SuppressFinalize(this);
        }

        protected virtual async Task DisposeAsync(bool disposing)
        {
            if (!disposedValue)
            {
                if (disposing && dbContextTransaction is not null)
                {
                    await dbContextTransaction.DisposeAsync();
                }
                disposedValue = true;
            }
        }
        #endregion
    }
}
