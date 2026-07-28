using System.Net;

namespace ATTours.Exceptions
{
    public class ModelValidationException : ErrorModelException
    {
        public string FieldPath { get; }

        public ModelValidationException(Enum errorCode, HttpStatusCode statusCode, string errorMessage)
            : base(errorCode, statusCode, errorMessage)
        { }

        public ModelValidationException(Enum errorCode, HttpStatusCode statusCode = HttpStatusCode.BadRequest)
           : base(errorCode, statusCode)
        { }

        public ModelValidationException(string propertyName, Enum errorCode, HttpStatusCode statusCode = HttpStatusCode.BadRequest)
            : this(errorCode, statusCode)
        {
            FieldPath = propertyName;
        }

        public ModelValidationException(string propertyName, Enum errorCode, HttpStatusCode statusCode, string errorMessage)
            : this(errorCode, statusCode, errorMessage)
        {
            FieldPath = propertyName;
        }
    }
}
