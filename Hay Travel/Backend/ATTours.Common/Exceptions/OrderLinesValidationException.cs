using System.Net;

namespace ATTours.Exceptions
{
    // Отказ валидации мульти-строчного заказа (ADR 025): несёт И плоский верхнеуровневый
    // ErrorCode (OrderHasInvalidLines, 2031 — для клиентов, читающих только общий код), И
    // список пер-строчных ошибок, чтобы фронт подсветил конкретные позиции корзины.
    //
    // Наследование от ErrorModelException обязывает поставить его цепочку обработчиков РАНЬШЕ
    // ErrorModelExceptionHandlerChain (см. ATToursExceptionMaster): иначе базовая цепочка
    // перехватит подтип первой и потеряет LineErrors.
    public class OrderLinesValidationException : ErrorModelException
    {
        public OrderLinesValidationException(Enum errorCode, IReadOnlyList<OrderLineValidationError> lineErrors)
            : base(errorCode, HttpStatusCode.BadRequest, "One or more order lines are invalid.")
        {
            LineErrors = lineErrors ?? [];
        }

        public IReadOnlyList<OrderLineValidationError> LineErrors { get; }
    }
}
