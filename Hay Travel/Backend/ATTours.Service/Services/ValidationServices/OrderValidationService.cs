using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.BusinessServices.Services.Availability;
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Как упаковывать отказ валидации.
    //
    // FailFast — историческое поведение: бросить плоский ErrorModelException с кодом первой
    // сработавшей проверки. Так читает ошибки правка своей брони (OrderUpdateService ->
    // PUT Order/Update): там заказ всегда однострочный, и фронт разбирает именно плоский код
    // (2014/2015/2016/2004). Менять ей контракт эта фича не должна.
    //
    // PerLine — чекаут корзины (ADR 025): собрать ошибки по ВСЕМ строкам и бросить
    // OrderLinesValidationException, чтобы клиент подсветил каждую отклонённую позицию.
    internal enum OrderValidationReporting
    {
        FailFast,
        PerLine
    }

    // Валидация заказа — по каждой его строке (ADR 019: тур/дата/гости живут на OrderLine,
    // не на Order). Здесь же — серверная блокировка брони на закрытую дату: фронт гасит дни
    // только для удобства, решение принимает бэкенд через ClosureRuleResolver.
    //
    // Окно бронирования («не дальше 3 месяцев вперёд») сознательно НЕ проверяется — это
    // фронтовый лимит (см. спецификацию 001, §8). Бэкенд отбивает прошедшие и закрытые дни.
    internal class OrderValidationService : EntityValidationContextDependentBase<Order, ATToursContextFactory>
    {
        private readonly OrderValidationReporting reporting;

        public OrderValidationService(List<Order> entities, IApplicationDbContext context,
            OrderValidationReporting reporting = OrderValidationReporting.FailFast)
            : base(entities, context)
        {
            this.reporting = reporting;
        }

        public override async Task ValidateEntitiesAsync()
        {
            var lineErrors = new List<OrderLineValidationError>();

            foreach (var order in Entities)
            {
                ValidateLineCount(order);

                // Индекс — позиция строки в коллекции агрегата. Порядок задан
                // OrderCreationService.EnrichAsync и совпадает с порядком строк в запросе,
                // то есть с позициями корзины на клиенте (удалений из коллекции до валидации
                // нет). Дополнительная страховка для фронта — пара TourId+TourDate в ответе.
                var index = 0;
                foreach (var line in order.Lines)
                {
                    var errorCode = await ResolveLineErrorAsync(line);

                    if (errorCode is not null)
                    {
                        if (reporting == OrderValidationReporting.FailFast)
                            throw BuildFlatException(errorCode.Value, line);

                        lineErrors.Add(new OrderLineValidationError
                        {
                            Index = index,
                            TourId = line.TourId,
                            TourDate = line.TourDate,
                            ErrorCode = (int)errorCode.Value
                        });
                    }

                    index++;
                }
            }

            if (lineErrors.Count > 0)
                throw new OrderLinesValidationException(GlobalErrorCode.OrderHasInvalidLines, lineErrors);
        }

        // Ошибки формы самой заявки, а не конкретной позиции: приходят плоским ErrorModel
        // без массива lines (spec 013 §3).
        private static void ValidateLineCount(Order order)
        {
            if (order.Lines.Count == 0)
                throw new ErrorModelException(GlobalErrorCode.OrderMustHaveAtLeastOneLine, HttpStatusCode.BadRequest,
                    "Order must have at least one line.");

            if (order.Lines.Count > OrderLimits.MaxOrderLines)
                throw new ErrorModelException(GlobalErrorCode.OrderTooManyLines, HttpStatusCode.BadRequest,
                    $"Order cannot have more than {OrderLimits.MaxOrderLines} lines, got {order.Lines.Count}.");
        }

        // Первая сработавшая причина на строку — для UI одной достаточно, а порядок проверок
        // задаёт приоритет: гости -> прошлое -> тур существует -> дата открыта.
        // null = строка валидна.
        private async Task<GlobalErrorCode?> ResolveLineErrorAsync(OrderLine line)
        {
            if (line.GuestCount < 1)
                return GlobalErrorCode.InvalidGuestCount;

            if (IsDateInPast(line))
                return GlobalErrorCode.OrderDateInPast;

            if (!await IsTourBookableAsync(line))
                return GlobalErrorCode.TourNotFound;

            if (await IsDateClosedAsync(line))
                return GlobalErrorCode.TourDateUnavailable;

            return null;
        }

        // Сообщения сохранены прежними — их читают логи и (в FailFast) существующие клиенты.
        private static ErrorModelException BuildFlatException(GlobalErrorCode errorCode, OrderLine line)
        {
            var message = errorCode switch
            {
                GlobalErrorCode.InvalidGuestCount => $"Guest count must be at least 1, got {line.GuestCount}.",
                GlobalErrorCode.OrderDateInPast => $"Tour date {line.TourDate:yyyy-MM-dd} is in the past.",
                GlobalErrorCode.TourNotFound => $"Tour with id {line.TourId} does not exist or is not available for booking.",
                GlobalErrorCode.TourDateUnavailable => $"Tour date {line.TourDate:yyyy-MM-dd} is closed for booking.",
                _ => $"Order line for tour {line.TourId} is invalid."
            };

            return new ErrorModelException(errorCode, HttpStatusCode.BadRequest, message);
        }

        // Сравнение по UTC-дню: сервер не знает часового пояса клиента, а TourDate — это
        // календарный день без зоны (ADR 012).
        private static bool IsDateInPast(OrderLine line)
            => line.TourDate < DateOnly.FromDateTime(DateTime.UtcNow);

        // Забронировать можно только опубликованный тур: черновик/архив для клиента
        // не существует (тот же фильтр, что и на публичном чтении тура).
        private async Task<bool> IsTourBookableAsync(OrderLine line)
            => await Context.Set<Tour>()
                            .AnyAsync(tour => tour.Id == line.TourId && tour.IsActive && !tour.IsArchived);

        private async Task<bool> IsDateClosedAsync(OrderLine line)
        {
            // Грузим применимые правила (глобальные + правила этого тура) и отдаём решение
            // резолверу: precedence правил нельзя выразить SQL-фильтром «дата закрыта».
            var rules = await Context.Set<ClosureRule>()
                                     .Where(rule => rule.TourId == null || rule.TourId == line.TourId)
                                     .ToListAsync();

            return ClosureRuleResolver.IsClosed(rules, line.TourDate, line.TourId);
        }
    }
}
