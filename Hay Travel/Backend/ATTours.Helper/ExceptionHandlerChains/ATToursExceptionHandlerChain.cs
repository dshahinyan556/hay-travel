using ATTours.Helper.ErrorModels;
using ATTours.Helper.ExceptionHandlers;
using ATTours.Exceptions;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.ExceptionHandlerChains
{
    public class ATToursExceptionHandlerChain : ExceptionHandlerChainBase
    {
        public ATToursExceptionHandlerChain(System.Exception exception, HttpContext context)
            : base(exception, context)
        {
        }

        protected override bool CanHandle() => Exception is ATToursException;

        protected override IExceptionHandler CreateHandler()
            => new ATToursExceptionHandler<ATToursException, ErrorBaseModel>(HttpContext.Response, (ATToursException)Exception);
    }
}
