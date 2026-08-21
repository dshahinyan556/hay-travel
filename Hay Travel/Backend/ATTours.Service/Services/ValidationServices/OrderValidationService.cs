using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.BusinessServices.Services.Availability;
using ATTours.Common.Entities;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация заказа — по каждой его строке (ADR 019: тур/дата/гости живут на OrderLine,
    // не на Order). Здесь же — серверная блокировка брони на закрытую дату: фронт гасит дни
    // только для удобства, решение принимает бэкенд через ClosureRuleResolver.
    //
    // Окно бронирования («не дальше 3 месяцев вперёд») сознательно НЕ проверяется — это
    // фронтовый лимит (см. спецификацию 001, §8). Бэкенд отбивает прошедшие и закрытые дни.
    internal class OrderValidationService : EntityValidationContextDependentBase<Order, ATToursContextFactory>
    {
        public OrderValidationService(List<Order> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var order in Entities)
            {
                foreach (var line in order.Lines)
                {
                    ValidateGuestCount(line);
                    ValidateDateNotInPast(line);
                    await ValidateTourIsBookableAsync(line);
                    await ValidateDateIsOpenAsync(line);
                }
            }
        }

        private static void ValidateGuestCount(OrderLine line)
        {
            if (line.GuestCount < 1)
                throw new ErrorModelException(GlobalErrorCode.InvalidGuestCount, HttpStatusCode.BadRequest,
                    $"Guest count must be at least 1, got {line.GuestCount}.");
        }

        // Сравнение по UTC-дню: сервер не знает часового пояса клиента, а TourDate — это
        // календарный день без зоны (ADR 012).
        private static void ValidateDateNotInPast(OrderLine line)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (line.TourDate < today)
                throw new ErrorModelException(GlobalErrorCode.OrderDateInPast, HttpStatusCode.BadRequest,
                    $"Tour date {line.TourDate:yyyy-MM-dd} is in the past.");
        }

        // Забронировать можно только опубликованный тур: черновик/архив для клиента
        // не существует (тот же фильтр, что и на публичном чтении тура).
        private async Task ValidateTourIsBookableAsync(OrderLine line)
        {
            var bookable = await Context.Set<Tour>()
                                        .AnyAsync(tour => tour.Id == line.TourId && tour.IsActive && !tour.IsArchived);
            if (!bookable)
                throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.BadRequest,
                    $"Tour with id {line.TourId} does not exist or is not available for booking.");
        }

        private async Task ValidateDateIsOpenAsync(OrderLine line)
        {
            // Грузим применимые правила (глобальные + правила этого тура) и отдаём решение
            // резолверу: precedence правил нельзя выразить SQL-фильтром «дата закрыта».
            var rules = await Context.Set<ClosureRule>()
                                     .Where(rule => rule.TourId == null || rule.TourId == line.TourId)
                                     .ToListAsync();

            if (ClosureRuleResolver.IsClosed(rules, line.TourDate, line.TourId))
                throw new ErrorModelException(GlobalErrorCode.TourDateUnavailable, HttpStatusCode.BadRequest,
                    $"Tour date {line.TourDate:yyyy-MM-dd} is closed for booking.");
        }
    }
}
