using ATTours.ContextRepository.QueryMakers.ProcedureQueryMakers;

namespace ATTours.ContextRepository.RepositoryAbstraction.Procedure
{
    public interface IProcedureRepository<TEntity>
    where TEntity : class
    {
        Task<List<TEntity>> ExecuteStoredProcedureAsync(ProcedureQueryMakerBase procedureQueryMaker, CancellationToken cancellationToken = default);
        Task<TEntity> ExecuteStoredProcedureSingleAsync(ProcedureQueryMakerBase procedureQueryMaker, CancellationToken cancellationToken = default);
    }
}
