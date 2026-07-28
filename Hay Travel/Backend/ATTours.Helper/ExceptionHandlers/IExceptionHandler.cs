namespace ATTours.Helper.ExceptionHandlers
{
    public interface IExceptionHandler
    {
        public Task<string> HandleExceptionAsync();
    }
}
