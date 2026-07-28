using ATTours.Exceptions;
using ATTours.Helper.Enums;
using ATTours.Helper.ExceptionHandlers;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using System.Net;

namespace ATTours.Helper.ExceptionHandlerChains
{
    public class MsSqlContextExceptionHandlerChain : ExceptionHandlerChainBase
    {
        public MsSqlContextExceptionHandlerChain(Exception exception, HttpContext context)
            : base(exception, context)
        {
        }

        protected override bool CanHandle()
        {
            return Exception.InnerException is SqlException databaseException;
        }

        protected override IExceptionHandler CreateHandler()
        {
            return new ErrorModelExceptionHandler(HttpContext.Response, new ErrorModelException(GlobalErrorCode.SqlException, HttpStatusCode.BadRequest, Exception.InnerException.Message));
        }
    }
}
