using ATTours.Helper.ExceptionHandlerChains;
using ATTours.Helper.ExceptionMasters;

namespace ATTours.ClientAPI.Middleware
{
    public class ATToursExceptionMaster(HttpContext context, Exception exception) : ExceptionMasterBase(context, exception)
    {
        protected override IExceptionHandlerChain BuildExceptionHandlerChain()
        {
            var errormModelChain = new ErrorModelExceptionHandlerChain(Exception, HttpContext);
            errormModelChain.SetNextExceptionHandlerChain(new ATToursExceptionHandlerChain(Exception, HttpContext));
            errormModelChain.SetNextExceptionHandlerChain(new MsSqlContextExceptionHandlerChain(Exception, HttpContext));
            return errormModelChain;
        }
    }
}
