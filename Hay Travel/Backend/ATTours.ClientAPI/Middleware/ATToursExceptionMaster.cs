using ATTours.Helper.ExceptionHandlerChains;
using ATTours.Helper.ExceptionMasters;

namespace ATTours.ClientAPI.Middleware
{
    public class ATToursExceptionMaster(HttpContext context, Exception exception) : ExceptionMasterBase(context, exception)
    {
        // Порядок звеньев значим: побеждает ПЕРВОЕ звено, чей CanHandle() вернул true, поэтому
        // более специфичный подтип обязан стоять раньше своего базового типа.
        //
        // 1. OrderLines — подтип ErrorModelException (ADR 025); стоя после базового звена, он
        //    никогда бы не сработал и пер-строчный список ошибок терялся бы.
        // 2. ErrorModel — доменные ошибки с кодом GlobalErrorCode (сюда же ModelValidationException).
        // 3. MsSql — ошибки провайдера БД.
        //
        // SetNextExceptionHandlerChain возвращает ПРИНЯТОЕ звено, а не this: раньше цепочка
        // собиралась двумя вызовами на одной голове (ErrorModel -> ATTours, ErrorModel -> MsSql),
        // и второй вызов затирал первый — ATToursExceptionHandlerChain был осиротевшим и не
        // вызывался никогда. Звеном его сюда сознательно НЕ возвращаем (spec 013 §2: по
        // умолчанию восстанавливаем поведение как было): единственный голый ATToursException
        // в коде — программная ошибка EnumExtensions, и отдавать её текст клиенту как 400
        // хуже, чем нынешние 500 «Internal Server Error» от UnAddressed-фолбэка.
        protected override IExceptionHandlerChain BuildExceptionHandlerChain()
        {
            var orderLinesChain = new OrderLinesValidationExceptionHandlerChain(Exception, HttpContext);

            orderLinesChain
                .SetNextExceptionHandlerChain(new ErrorModelExceptionHandlerChain(Exception, HttpContext))
                .SetNextExceptionHandlerChain(new MsSqlContextExceptionHandlerChain(Exception, HttpContext));

            return orderLinesChain;
        }
    }
}
