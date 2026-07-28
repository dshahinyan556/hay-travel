using ATTours.Helper.ExceptionHandlers;

namespace ATTours.Helper.ExceptionHandlerChains
{
    public interface IExceptionHandlerChain
    {
        IExceptionHandlerChain SetNextExceptionHandlerChain(IExceptionHandlerChain next);
        IExceptionHandler GetExceptionHandler();
    }
}
