using ATTours.Helper.ErrorModels;
using ATTours.Exceptions;
using ATTours.Helper.ResponseBuilders;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.ExceptionHandlers
{
    public class ExceptionSimpleHandler<TException, TErrorModel>(HttpResponse httpResponse, TException exception) : ExceptionSimpleHandlerBase<TErrorModel>
        where TException : ATToursException
        where TErrorModel : ErrorBaseModel, new()
    {
        protected HttpResponse HttpResponse => httpResponse;
        protected TException Exception => exception;

        protected override IHttpResponseBuilder<TErrorModel> ResponseBuilder => new HttpJsonResponseBuilder<TErrorModel>(HttpResponse);

        protected override async Task<TErrorModel> GetErrorResponseModelAsync()
        {
            return await Task.FromResult<TErrorModel>(new()
            {
                HttpStatusCode = (int)Exception.HttpStatusCode,
                Message = Exception.Message
            });
        }
    }
}
