namespace ATTours.Helper.ErrorModels
{
    public class ErrorBaseModel : IHttpResponseStatus
    {
        public virtual int HttpStatusCode { get; set; }
        public virtual string Message { get; set; }
    }
}
