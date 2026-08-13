using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.BusinessServices.Services.Availability;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация брони. Здесь же — серверная блокировка заказа на закрытую дату: фронт
    // гасит дни только для удобства, решение принимает бэкенд через ClosureRuleResolver.
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
            foreach (var entity in Entities)
            {
                ValidateGuestCount(entity);
                ValidateDateNotInPast(entity);
                await ValidateTourIsBookableAsync(entity);
                await ValidateDateIsOpenAsync(entity);
            }
        }

        private static void ValidateGuestCount(Order order)
        {
            if (order.GuestCount < 1)
                throw new ErrorModelException(GlobalErrorCode.InvalidGuestCount, HttpStatusCode.BadRequest,
                    $"Guest count must be at least 1, got {order.GuestCount}.");
        }

        // Сравнение по UTC-дню: сервер не знает часового пояса клиента, а TourDate — это
        // календарный день без зоны (ADR 012).
        private static void ValidateDateNotInPast(Order order)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (order.TourDate < today)
                throw new ErrorModelException(GlobalErrorCode.OrderDateInPast, HttpStatusCode.BadRequest,
                    $"Tour date {order.TourDate:yyyy-MM-dd} is in the past.");
        }

        // Забронировать можно только опубликованный тур: черновик/архив для клиента
        // не существует (тот же фильтр, что и на публичном чтении тура).
        private async Task ValidateTourIsBookableAsync(Order order)
        {
            var bookable = await Context.Set<Tour>()
                                        .AnyAsync(tour => tour.Id == order.TourId && tour.IsActive && !tour.IsArchived);
            if (!bookable)
                throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.BadRequest,
                    $"Tour with id {order.TourId} does not exist or is not available for booking.");
        }

        private async Task ValidateDateIsOpenAsync(Order order)
        {
            // Грузим применимые правила (глобальные + правила этого тура) и отдаём решение
            // резолверу: precedence правил нельзя выразить SQL-фильтром «дата закрыта».
            var rules = await Context.Set<ClosureRule>()
                                     .Where(rule => rule.TourId == null || rule.TourId == order.TourId)
                                     .ToListAsync();

            if (ClosureRuleResolver.IsClosed(rules, order.TourDate, order.TourId))
                throw new ErrorModelException(GlobalErrorCode.TourDateUnavailable, HttpStatusCode.BadRequest,
                    $"Tour date {order.TourDate:yyyy-MM-dd} is closed for booking.");
        }
    }
}
