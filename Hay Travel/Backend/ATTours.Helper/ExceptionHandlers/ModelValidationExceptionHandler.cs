using ATTours.Helper.ErrorModels;
using ATTours.Exceptions;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.ExceptionHandlers
{
    public class ModelValidationExceptionHandler(HttpResponse httpResponse, ModelValidationException exception)
                 : ATToursExceptionHandler<ModelValidationException, ModelValidationErrorModel>(httpResponse, exception)
    {
        protected override async Task<ModelValidationErrorModel> GetErrorModelAsync()
        {
            var errorModel = await base.GetErrorModelAsync();
            errorModel.ErrorCode = Convert.ToInt32(Exception.ErrorCode);
            errorModel.InvalidMemberPath = Exception.FieldPath;
            return errorModel;
        }
    }
}
