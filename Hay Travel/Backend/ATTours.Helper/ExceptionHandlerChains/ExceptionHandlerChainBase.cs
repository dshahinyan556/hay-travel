using ATTours.Helper.ExceptionHandlers;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.ExceptionHandlerChains
{
    public abstract class ExceptionHandlerChainBase : IExceptionHandlerChain
    {
        protected ExceptionHandlerChainBase(Exception exception, HttpContext context)
        {
            Exception = exception;
            HttpContext = context;
        }

        protected Exception Exception { get; }
        protected HttpContext HttpContext { get; }

        private IExceptionHandlerChain nextExceptionHandlerChain;
        public IExceptionHandlerChain SetNextExceptionHandlerChain(IExceptionHandlerChain exceptionHandlerChain)
        {
            nextExceptionHandlerChain = exceptionHandlerChain;
            return exceptionHandlerChain;
        }

        public IExceptionHandler GetExceptionHandler()
        {
            if (CanHandle())
                return CreateHandler();

            return nextExceptionHandlerChain?.GetExceptionHandler();
        }
        protected abstract bool CanHandle();
        protected abstract IExceptionHandler CreateHandler();
    }
}
