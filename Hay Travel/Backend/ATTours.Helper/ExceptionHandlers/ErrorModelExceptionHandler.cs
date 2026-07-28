using ATTours.Helper.ErrorModels;
using ATTours.Exceptions;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.ExceptionHandlers
{
    public class ErrorModelExceptionHandler : ATToursExceptionHandler<ErrorModelException, ErrorModel>
    {
        public ErrorModelExceptionHandler(HttpResponse httpResponse, ErrorModelException exception)
            : base(httpResponse, exception)
        {
        }
        protected override async Task<ErrorModel> GetErrorModelAsync()
        {
            var errorModel = await base.GetErrorModelAsync();
            errorModel.ErrorCode = Convert.ToInt32(Exception.ErrorCode);
            return errorModel;
        }

        protected override ErrorModel GetDefaultErrorModel()
        {
            var errorModel = base.GetDefaultErrorModel();
            errorModel.ErrorCode = Convert.ToInt32(Exception.ErrorCode);
            errorModel.Message = Exception.ErrorCode.ToString();
            return errorModel;
        }
    }
}
