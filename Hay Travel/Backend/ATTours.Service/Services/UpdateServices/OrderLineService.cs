using ArmeniaTours.DataLayer;
using ATTours.Common.DTO.Init;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Extensions;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Админское управление строками уже существующего заказа: добавить/убрать/поправить
    // предоплату (ADR 019, checklist-orders-redesign.txt Фаза 1).
    // Права владельца здесь не проверяются — эндпоинты только для админа (см. контроллер).
    public class OrderLineService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderLineService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task<OrderLine> AddLineAsync(OrderLineCreateModel model)
        {
            var order = await EntityRepository.AsQueryable()
                                              .Include(x => x.Lines)
                                              .SingleOrDefaultAsync(x => x.Id == model.OrderId, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {model.OrderId} not found.");

            var tourData = await Context.Set<Tour>()
                                        .Where(tour => tour.Id == model.TourId)
                                        .Select(tour => new { tour.TotalPrice, tour.DiscountPercent, tour.DiscountStartDate, tour.DiscountValidUntil })
                                        .SingleOrDefaultAsync(cancellationToken)
                            ?? throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.BadRequest,
                                $"Tour with id {model.TourId} not found.");

            var priceSnapshot = tourData.TotalPrice ?? 0m;
            // На дату поездки строки, а не на "сегодня" (checklist-discount-fix.txt, баг 2) —
            // тот же принцип, что в OrderCreationService.
            var discountPercent = TourDiscountExtensions.ResolveActiveDiscountPercent(
                tourData.DiscountPercent, tourData.DiscountStartDate, tourData.DiscountValidUntil, model.TourDate);
            var discounted = TourDiscountExtensions.ApplyDiscount(priceSnapshot, discountPercent) ?? priceSnapshot;

            var line = new OrderLine
            {
                OrderId = order.Id,
                TourId = model.TourId,
                TourDate = model.TourDate,
                GuestCount = model.GuestCount,
                RequiresPrepayment = model.RequiresPrepayment,
                PrepaymentAmount = model.PrepaymentAmount,
                PriceSnapshot = priceSnapshot,
                DiscountPercent = discountPercent,
                LineTotal = discounted
            };

            order.Lines.Add(line);
            await EntityRepository.SaveChangesAsync(cancellationToken);
            return line;
        }

        // Возвращает снапшот удалённой строки: после Remove читать уже нечего, а журналу
        // (spec 007) нужно написать, какая именно строка ушла.
        public async Task<OrderLineRemovedResult> RemoveLineAsync(int lineId)
        {
            var line = await Context.Set<OrderLine>()
                                    .Include(x => x.Order)
                                        .ThenInclude(x => x.Lines)
                                    .SingleOrDefaultAsync(x => x.Id == lineId, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.OrderLineNotFound, HttpStatusCode.NotFound,
                           $"Order line with id {lineId} not found.");

            if (line.Order.Lines.Count <= 1)
                throw new ErrorModelException(GlobalErrorCode.OrderMustHaveAtLeastOneLine, HttpStatusCode.BadRequest,
                    "Cannot remove the last remaining line of an order.");

            var snapshot = new OrderLineRemovedResult
            {
                OrderId = line.OrderId,
                TourId = line.TourId,
                TourDate = line.TourDate,
                GuestCount = line.GuestCount
            };

            Context.Set<OrderLine>().Remove(line);
            await Context.SaveChangesAsync(cancellationToken);

            return snapshot;
        }

        public async Task UpdateLineAsync(OrderLineUpdateModel model)
        {
            var line = await Context.Set<OrderLine>().SingleOrDefaultAsync(x => x.Id == model.Id, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.OrderLineNotFound, HttpStatusCode.NotFound,
                           $"Order line with id {model.Id} not found.");

            // "Детали для выполнения" здесь больше не правятся: они переехали на исполнителя
            // (OrderLineEmployeeUpdateService, редизайн 2026-08-23).
            line.RequiresPrepayment = model.RequiresPrepayment;
            line.PrepaymentAmount = model.PrepaymentAmount;

            await Context.SaveChangesAsync(cancellationToken);
        }
    }

    public class OrderLineRemovedResult
    {
        public int OrderId { get; set; }
        public int TourId { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
    }
}
