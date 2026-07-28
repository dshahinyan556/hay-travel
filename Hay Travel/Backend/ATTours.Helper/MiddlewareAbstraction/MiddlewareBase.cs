using ATTours.Helper.ExceptionMasters;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.MiddlewareAbstraction
{
    public abstract class MiddlewareBase(RequestDelegate next) : IErrorHandlingMiddleware
    {
        public async Task Invoke(HttpContext context)
        {
            try
            {
                await NextAsync(context);
            }
            catch (Exception exception)
            {
                await HandleExceptionAsync(context, exception);
            }
        }

        protected virtual async Task NextAsync(HttpContext context)
        {
            await next(context);
        }

        protected virtual async Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            var exceptionMaster = CreateExceptionMaster(context, exception);
            await exceptionMaster.HandleExceptionAsync();
        }

        protected abstract IExceptionMaster CreateExceptionMaster(HttpContext context, Exception exception);
    }
}
