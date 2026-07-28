using ATTours.Helper.ErrorModels;

namespace ATTours.Helper.ResponseBuilders
{
    public interface IHttpResponseBuilder<TModel>
        where TModel : IHttpResponseStatus
    {
        Task FillResponseInfo(TModel responseModel);
    }
}
