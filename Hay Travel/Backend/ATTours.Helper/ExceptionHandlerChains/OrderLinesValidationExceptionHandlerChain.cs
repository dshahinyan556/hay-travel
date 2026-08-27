using ATTours.Exceptions;
using ATTours.Helper.ExceptionHandlers;
using Microsoft.AspNetCore.Http;

namespace ATTours.Helper.ExceptionHandlerChains
{
    // Обязана стоять в цепочке РАНЬШЕ ErrorModelExceptionHandlerChain: OrderLinesValidationException
    // — подтип ErrorModelException, и базовая цепочка перехватила бы его первой, потеряв
    // пер-строчный список (ADR 025, развилка Р3).
    public class OrderLinesValidationExceptionHandlerChain : ExceptionHandlerChainBase
    {
        public OrderLinesValidationExceptionHandlerChain(Exception exception, HttpContext context)
            : base(exception, context)
        {
        }

        protected override bool CanHandle() => Exception is OrderLinesValidationException;

        protected override IExceptionHandler CreateHandler()
            => new OrderLinesValidationExceptionHandler(HttpContext.Response, (OrderLinesValidationException)Exception);
    }
}
