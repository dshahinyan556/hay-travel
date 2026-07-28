using ATTours.ContextRepository.DTO.Enums;
using ATTours.ContextRepository.Resources;

namespace ATTours.ContextRepository.QueryMakers.ProcedureQueryMakers
{
    public class SqlProcedureQueryMaker : ProcedureQueryMakerBase
    {
        public SqlProcedureQueryMaker(string procedureName, IEnumerable<string> parameters)
            : base(procedureName, parameters)
        {
        }
        protected override ProcedureSymbolType ProcedureSymbolType => ProcedureSymbolType.Sql;

        protected override string GetProcedureTemplate()
            => DatabaseVariables.SqlProcedureTemplate;
    }
}
