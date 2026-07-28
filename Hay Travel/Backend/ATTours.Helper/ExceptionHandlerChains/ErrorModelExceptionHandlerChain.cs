using ATTours.Helper.ExceptionHandlers;
using ATTours.Exceptions;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.ExceptionHandlerChains
{
    public class ErrorModelExceptionHandlerChain : ExceptionHandlerChainBase
    {
        public ErrorModelExceptionHandlerChain(Exception exception, HttpContext context)
            : base(exception, context)
        {
        }

        protected override bool CanHandle() => Exception is ErrorModelException;

        protected override IExceptionHandler CreateHandler()
            => new ErrorModelExceptionHandler(HttpContext.Response, (ErrorModelException)Exception);
    }
}
