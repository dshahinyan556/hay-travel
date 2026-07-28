using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.MiddlewareAbstraction
{
    public interface IErrorHandlingMiddleware
    {
        public Task Invoke(HttpContext context);
    }
}
