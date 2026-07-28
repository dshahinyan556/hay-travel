using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Procedure;
using ATTours.ContextRepository.RepositoryImplementation.Procedure;

namespace ATTours.ContextRepository
{
    public class ProcedureRepositoryCoreBase<TEntity,TContextFactory> : CoreBase<TContextFactory>
        where TEntity : class
        where TContextFactory : IApplicationContextFactory, new()
    {
        public ProcedureRepositoryCoreBase(string connectionString) 
            : base(connectionString)
        {
        }

        public ProcedureRepositoryCoreBase(IApplicationDbContext context) 
            : base(context)
        {
        }

        #region Properties

        private IProcedureRepository<TEntity> entityRepository;
        protected IProcedureRepository<TEntity> EntityRepository
        {
            get => entityRepository ??= new ProcedureRepository<TEntity>(Context);
        }

        #endregion
    }
}
