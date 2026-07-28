using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;

namespace ATTours.ContextRepository
{
    public class RepositoryCoreBase<TEntity, TContextFactory> : CoreBase<TContextFactory>
        where TEntity : class
        where TContextFactory : IApplicationContextFactory, new()
    {
        public RepositoryCoreBase(string connectionString)
            : base(connectionString)
        { }
        public RepositoryCoreBase(IApplicationDbContext context)
            : base(context)
        { }

        private IEntityRepository<TEntity> entityRepository;
        protected IEntityRepository<TEntity> EntityRepository
        {
            get => entityRepository ??= new EntityRepository<TEntity>(Context);
        }
    }
}
