using ATTours.Helper.ExceptionHandlerChains;
using ATTours.Helper.ExceptionHandlers;
using Microsoft.AspNetCore.Http;
using System.Net;

namespace ATTours.Helper.ExceptionMasters
{
    public abstract class ExceptionMasterBase : IExceptionMaster
    {
        protected ExceptionMasterBase(HttpContext context, Exception exception)
        {
            HttpContext = context;
            Exception = exception;
        }

        protected HttpContext HttpContext { get; }
        protected Exception Exception { get; }

        public async Task HandleExceptionAsync()
        {
            try
            {
                var exceptionHandler = GetExceptionHandler();
                var responseMessage = await exceptionHandler.HandleExceptionAsync();

            }
            catch (Exception ex)
            {
                var exceptionHandlerChain = GetUnAddressedExceptionHandlerChain();
                var exceptionHandler = exceptionHandlerChain.GetExceptionHandler();
                var responseMessage = await exceptionHandler.HandleExceptionAsync();

                //var exceptionMessage = Exception.GetExceptionMessageRecursive();
                //var joinedMessage = JoinLogMessage(exceptionMessage, "\n UnhandledException \n", ex.GetExceptionMessageRecursive(),
                //                                   "\n UnhandledResponse \n", responseMessage);
            }
        }

        private IExceptionHandler GetExceptionHandler()
        {
            var exceptionHandlerChain = BuildExceptionHandlerChain();
            exceptionHandlerChain ??= GetUnAddressedExceptionHandlerChain();

            return exceptionHandlerChain.GetExceptionHandler();
        }

        protected abstract IExceptionHandlerChain BuildExceptionHandlerChain();

        private IExceptionHandlerChain GetUnAddressedExceptionHandlerChain()
        {
            return SelectUnAddressedExceptionHandlerChain(HttpStatusCode.InternalServerError, "Internal Server Error");
        }

        protected virtual IExceptionHandlerChain SelectUnAddressedExceptionHandlerChain(HttpStatusCode httpStatusCode, string message)
        {
            return new UnAddressedExceptionHandlerChain(httpStatusCode, message, Exception, HttpContext);
        }

    }
}
