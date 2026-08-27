using ATTours.Exceptions;
using ATTours.Helper.ErrorModels;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.ExceptionHandlers
{
    // То же, что ErrorModelExceptionHandler (плоский ErrorCode), плюс проекция пер-строчных
    // ошибок в тело ответа (ADR 025).
    public class OrderLinesValidationExceptionHandler
        : ATToursExceptionHandler<OrderLinesValidationException, OrderLinesErrorModel>
    {
        public OrderLinesValidationExceptionHandler(HttpResponse httpResponse, OrderLinesValidationException exception)
            : base(httpResponse, exception)
        {
        }

        protected override async Task<OrderLinesErrorModel> GetErrorModelAsync()
        {
            var errorModel = await base.GetErrorModelAsync();
            errorModel.ErrorCode = Convert.ToInt32(Exception.ErrorCode);
            errorModel.Lines = MapLines();
            return errorModel;
        }

        protected override OrderLinesErrorModel GetDefaultErrorModel()
        {
            var errorModel = base.GetDefaultErrorModel();
            errorModel.ErrorCode = Convert.ToInt32(Exception.ErrorCode);
            errorModel.Message = Exception.ErrorCode.ToString();
            return errorModel;
        }

        private List<OrderLineErrorItem> MapLines()
            => [.. Exception.LineErrors.Select(error => new OrderLineErrorItem
            {
                Index = error.Index,
                TourId = error.TourId,
                TourDate = error.TourDate,
                ErrorCode = error.ErrorCode
            })];
    }
}
