using System.Net;

namespace ATTours.Exceptions
{
    public class ATToursException : Exception
    {
        public ATToursException(HttpStatusCode httpStatusCode)
        {
            HttpStatusCode = httpStatusCode;
        }

        public ATToursException(string message)
            : base(message)
        {
        }
        public ATToursException(string message, Exception innerException)
          : base(message, innerException)
        {
        }
        public ATToursException(HttpStatusCode httpStatusCode, string message)
            : base(message)
        {
            HttpStatusCode = httpStatusCode;
        }
        public ATToursException(HttpStatusCode httpStatusCode, string message, Exception innerException)
           : base(message, innerException)
        {
            HttpStatusCode = httpStatusCode;
        }
        public HttpStatusCode HttpStatusCode { get; } = HttpStatusCode.BadRequest;
    }
}
