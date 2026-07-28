using ATTours.Helper.ExceptionMasters;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.MiddlewareAbstraction
{
    public class InitializableMiddlewareBase<TExceptionMaster>(RequestDelegate next) : MiddlewareBase(next)
        where TExceptionMaster : IExceptionMaster
    {
        protected override IExceptionMaster CreateExceptionMaster(HttpContext context, Exception exception)
        {
            return (IExceptionMaster)Activator.CreateInstance(typeof(TExceptionMaster), context, exception);
        }
    }
}
