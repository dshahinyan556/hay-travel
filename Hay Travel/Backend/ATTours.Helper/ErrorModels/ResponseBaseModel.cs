namespace ATTours.Helper.ErrorModels
{
    public class ResponseBaseModel<T> : IResponseBaseModel
    {
        public T Model { get; set; }
        public ErrorBaseModel ErrorModel { get; set; }

    }
}
