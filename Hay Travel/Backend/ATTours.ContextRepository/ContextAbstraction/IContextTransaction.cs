namespace ATTours.ContextRepository.ContextAbstraction
{
    public interface IContextTransaction : IDisposable, IAsyncDisposable
    {
        void Commit();
        Task CommitAsync(CancellationToken cancellationToken = default);
    }
}
