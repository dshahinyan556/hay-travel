using ATTours.Helper.ErrorModels;
using ATTours.Helper.ResponseBuilders;
using Newtonsoft.Json;

namespace ATTours.Helper.ExceptionHandlers
{
    public abstract class ExceptionSimpleHandlerBase<TModel> : IExceptionHandler
         where TModel : IHttpResponseStatus
    {
        protected abstract IHttpResponseBuilder<TModel> ResponseBuilder { get; }

        public async Task<string> HandleExceptionAsync()
        {
            var errorModel = await GetErrorResponseModelAsync();
            await ResponseBuilder.FillResponseInfo(errorModel);
            return JsonConvert.SerializeObject(errorModel);
        }

        protected abstract Task<TModel> GetErrorResponseModelAsync();
    }
}
