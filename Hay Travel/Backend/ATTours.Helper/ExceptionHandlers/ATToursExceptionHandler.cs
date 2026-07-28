using ATTours.Helper.ErrorModels;
using ATTours.Exceptions;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.ExceptionHandlers
{
    public class ATToursExceptionHandler<TException, TErrorModel> : ExceptionSimpleHandler<TException, TErrorModel>
        where TException : ATToursException
        where TErrorModel : ErrorBaseModel, new()
    {
        public ATToursExceptionHandler(HttpResponse httpResponse, TException exception)
            : base(httpResponse, exception)
        {
        }

        protected override async Task<TErrorModel> GetErrorResponseModelAsync()
        {
            try
            {
                return await GetErrorModelAsync();
            }
            catch (Exception)
            {
                return GetDefaultErrorModel();
            }
        }
        protected virtual async Task<TErrorModel> GetErrorModelAsync()
        {
            return await Task.FromResult(new TErrorModel
            {
                HttpStatusCode = (int)Exception.HttpStatusCode,
                Message = Exception.Message
            });
        }

        protected virtual TErrorModel GetDefaultErrorModel()
        {
            return new() { HttpStatusCode = (int)Exception.HttpStatusCode };
        }
    }
}
