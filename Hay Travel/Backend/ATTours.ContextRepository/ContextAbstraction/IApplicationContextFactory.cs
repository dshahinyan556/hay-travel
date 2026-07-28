namespace ATTours.ContextRepository.ContextAbstraction
{
    public interface IApplicationContextFactory
    {
        IApplicationDbContext CreateContext(string connectionString);
    }
}
