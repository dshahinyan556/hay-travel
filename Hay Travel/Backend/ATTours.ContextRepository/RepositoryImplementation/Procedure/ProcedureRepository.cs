using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.QueryMakers.ProcedureQueryMakers;
using ATTours.ContextRepository.RepositoryAbstraction.Procedure;
using Microsoft.EntityFrameworkCore;

namespace ATTours.ContextRepository.RepositoryImplementation.Procedure
{
    public class ProcedureRepository<TEntity> : IProcedureRepository<TEntity>
       where TEntity : class
    {
        public ProcedureRepository(IApplicationDbContext context)
        {
            Context = context;
        }
        protected IApplicationDbContext Context { get; }
        protected DbSet<TEntity> Entities => Context.Set<TEntity>();

        public async Task<List<TEntity>> ExecuteStoredProcedureAsync(ProcedureQueryMakerBase procedureQueryMaker, CancellationToken cancellationToken = default)
        {
            return await Entities.FromSqlRaw(procedureQueryMaker.GetProcedureQuery()).ToListAsync(cancellationToken);
        }
        public async Task<TEntity> ExecuteStoredProcedureSingleAsync(ProcedureQueryMakerBase procedureQueryMaker, CancellationToken cancellationToken = default)
        {
            return (await ExecuteStoredProcedureAsync(procedureQueryMaker, cancellationToken)).Single();
        }
    }
}
