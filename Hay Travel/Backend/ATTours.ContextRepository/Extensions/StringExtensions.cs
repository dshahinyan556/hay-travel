using ATTours.Common.Extensions;
using ATTours.ContextRepository.DTO.Enums;

namespace ATTours.ContextRepository.Extensions
{
    public static class StringExtensions
    {
        public static string ToProcedureParameter(this string parameterValue, ProcedureSymbolType symbolType)
        {
            var symbolStr = symbolType.TryGetDescriptionName();
            return symbolStr + parameterValue + symbolStr;
        }
    }
}
