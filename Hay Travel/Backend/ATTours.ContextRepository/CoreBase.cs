using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.ContextRepository
{
    public class CoreBase<TContextFactory> : IDisposable, IAsyncDisposable
         where TContextFactory : IApplicationContextFactory, new()
    {
        private readonly string connectionString;
        public CoreBase(string connectionString)
        {
            this.connectionString = connectionString;
        }

        [ActivatorUtilitiesConstructor]
        public CoreBase(IApplicationDbContext context)
        {
            this.context = context;
        }

        #region Properties
        private IApplicationDbContext context;
        protected IApplicationDbContext Context => context ??= GetContext();
        private IApplicationDbContext GetContext() => new TContextFactory().CreateContext(connectionString);
        #endregion

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
                    context?.Dispose();
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
                if (disposing && context is not null)
                {
                    await context.DisposeAsync();
                }
                disposedValue = true;
            }
        }

        #endregion
    }
}
