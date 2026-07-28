using ATTours.Helper.Enums;
using ATTours.Exceptions;
using ATTours.Helper.Helper;
using ATTours.Helper.Resources;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Net;
using System.Text.RegularExpressions;

namespace ATTours.Helper.Filter
{
    public class FieldValidationActionFilter : ActionValidationFilterBase
    {
        private static Dictionary<FieldValidationErrorCode, Regex> ErrorCodeRegexValues { get; } = new()
        {
            { FieldValidationErrorCode.UnexpectedFields, RegexHelper.Create(ValidationRegexValues.UexpectedFieldsErrorMessageFormat) },
            { FieldValidationErrorCode.MissingRequiredFields, RegexHelper.Create(ValidationRegexValues.RequiredFieldErrorMessageFormat) },
            { FieldValidationErrorCode.EmptyRequestBody, RegexHelper.Create(ValidationRegexValues.EmptyRequestBodyErrorMessageFormat) }
        };

        protected async override Task OnEnabledExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            if (!context.ModelState.IsValid)
                ValidateFactory(context);
            await next();
        }

        protected virtual void ValidateFactory(ActionExecutingContext context)
        {
            foreach (var errorCode in Enum.GetValues<FieldValidationErrorCode>())
                VerifyFieldErrors(context, errorCode);
        }

        private static void VerifyFieldErrors(ActionExecutingContext context, FieldValidationErrorCode errorCode)
        {
            var regex = ErrorCodeRegexValues[errorCode];
            var fieldErrors = context.ModelState.Where(ms => ms.Value.Errors.Any(error => regex.IsMatch(error.ErrorMessage)))
                                                .Select(ms => new FieldErrorModel { FieldPath = ms.Key, FieldModelState = ms.Value }).ToList();
            var fieldError = fieldErrors.FirstOrDefault();
            if (fieldError != null)
                GenerateValidationException(context, fieldError);
        }

        protected static void GenerateValidationException(ActionExecutingContext context, FieldErrorModel fieldError)
        {
            context.Result = new BadRequestObjectResult(fieldError.FieldPath);
            var errorMessage = fieldError.FieldModelState.Errors.FirstOrDefault(x => !string.IsNullOrEmpty(x.ErrorMessage)).ErrorMessage;
            var fieldPath = string.IsNullOrEmpty(fieldError.FieldPath) ? fieldError.FieldPath : FieldFullPathHelper.RemoveArrayIndices(fieldError.FieldPath);
            throw new ModelValidationException(fieldPath, GlobalErrorCode.DataFormatMismatch, HttpStatusCode.BadRequest, errorMessage);
        }
    }
}
