using ATTours.Helper.ErrorModels;
using ATTours.Helper.ExceptionHandlers;
using ATTours.Exceptions;
using Microsoft.AspNetCore.Http;
using System.Net;
namespace ATTours.Helper.ExceptionHandlerChains
{
    public class UnAddressedExceptionHandlerChain : ExceptionHandlerChainBase
    {
        private readonly HttpStatusCode httpStatusCode;
        private readonly string message;

        public UnAddressedExceptionHandlerChain(HttpStatusCode httpStatusCode, string message,Exception exception, HttpContext context)
            : base(exception, context)
        {
            this.httpStatusCode = httpStatusCode;
            this.message = message;
        }

        protected override bool CanHandle() => true;

        protected override IExceptionHandler CreateHandler()
        {
            return new ExceptionSimpleHandler<ATToursException, ErrorBaseModel>(HttpContext.Response, new(httpStatusCode, message));
        }
    }
}
