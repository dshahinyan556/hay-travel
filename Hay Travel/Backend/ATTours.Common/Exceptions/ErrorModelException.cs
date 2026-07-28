using System.Net;
using System.Text;

namespace ATTours.Exceptions
{
    public class ErrorModelException : ATToursException
    {
        protected ErrorModelException(Enum errorCode, HttpStatusCode httpStatusCode = HttpStatusCode.BadRequest)
           : base(httpStatusCode)
        {
            ErrorCode = errorCode;
        }
        public ErrorModelException(Enum errorCode, HttpStatusCode httpStatusCode, string message)
            : base(httpStatusCode, message)
        {
            ErrorCode = errorCode;
        }

        public ErrorModelException(Enum errorCode, HttpStatusCode httpStatusCode, string message, Exception innerException)
            :base(httpStatusCode, message, innerException)
        {
            ErrorCode= errorCode;
        }

        public Enum ErrorCode { get; }

        public override string ToString()
        {
            var errorMessageBuilder = new StringBuilder("ErrorModel exception");
            errorMessageBuilder.AppendLine($"StatusCode: {HttpStatusCode}");
            errorMessageBuilder.AppendLine($"ErrorCode: {ErrorCode}");
            errorMessageBuilder.AppendLine($"Message: {Message}");
            return errorMessageBuilder.ToString();
        }
    }
}
