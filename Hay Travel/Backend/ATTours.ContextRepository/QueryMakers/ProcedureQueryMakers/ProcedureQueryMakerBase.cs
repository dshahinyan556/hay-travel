using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using ATTours.ContextRepository.DTO.Enums;
using ATTours.ContextRepository.Extensions;

namespace ATTours.ContextRepository.QueryMakers.ProcedureQueryMakers
{
    public abstract class ProcedureQueryMakerBase
    {
        private readonly string procedureName;
        private readonly IEnumerable<string> parameters;

        protected ProcedureQueryMakerBase(string procedureName, IEnumerable<string> parameters)
        {
            this.procedureName = procedureName;
            this.parameters = parameters;
        }

        protected abstract ProcedureSymbolType ProcedureSymbolType { get; }
        protected abstract string GetProcedureTemplate();

        public string GetProcedureQuery()
        {
            var query = string.Format(GetProcedureTemplate(), procedureName, GetProcedureParameter(parameters));
            return query;
        }

        private string GetProcedureParameter(IEnumerable<string> parameters)
            => string.Join(SymbolType.Comma.ToChar(), parameters.Select(x => x.ToProcedureParameter(ProcedureSymbolType)));

    }
}
