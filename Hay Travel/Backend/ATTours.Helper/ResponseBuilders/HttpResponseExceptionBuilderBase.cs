using ATTours.Helper.ErrorModels;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.ResponseBuilders
{
    public abstract class HttpResponseExceptionBuilderBase<TModel>(HttpResponse httpResponse) : IHttpResponseBuilder<TModel>
        where TModel : IHttpResponseStatus
    {
        private readonly HttpResponse httpResponse = httpResponse;

        public async Task FillResponseInfo(TModel responseModel)
        {
            httpResponse.ContentType = MediaType;
            httpResponse.StatusCode = responseModel.HttpStatusCode;
            await httpResponse.WriteAsync(Serialize(responseModel));
        }

        protected abstract string MediaType { get; }

        protected abstract string Serialize(TModel model);
    }
}
