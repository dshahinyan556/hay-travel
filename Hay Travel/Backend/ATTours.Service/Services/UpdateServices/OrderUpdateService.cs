using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Shared;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Правка своей брони с публичного сайта (ADR 019): бронь с сайта — всегда заказ с ОДНОЙ
    // строкой, поэтому Id адресует Order, а сервис находит и правит его единственную строку.
    // Разрешена только пока заказ Open/PendingPayment — как только админ её тронул (Hold/
    // Approved/Rejected/ReadyForAssignment/Completed), правка с сайта закрывается.
    //
    // Правка нескольких строк заказа админом — отдельный сервис (OrderLineService), у него
    // другие правила доступа (админ, а не владелец) и другой набор редактируемых полей.
    public class OrderUpdateService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // Возвращает «было/стало» вместо самого Order: сущность наружу никем не читалась
        // (контроллер перечитывает заказ через OrderInfo), а журналу (spec 007) нужны
        // прежние дата/гости, которые после записи уже не восстановить.
        public async Task<OrderUpdateResult> UpdateAsync(int id, DateOnly tourDate, int guestCount)
        {
            var order = await EntityRepository.AsQueryable()
                                              .Include(x => x.Lines)
                                              .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {id} not found.");

            if (order.Status != OrderStatus.Open && order.Status != OrderStatus.PendingPayment)
                throw new ErrorModelException(GlobalErrorCode.OrderNotEditable, HttpStatusCode.BadRequest,
                    $"Order with id {id} can no longer be edited (status: {order.Status}).");

            if (order.Lines.Count != 1)
                throw new ErrorModelException(GlobalErrorCode.OrderNotEditable, HttpStatusCode.BadRequest,
                    $"Order with id {id} has more than one line and cannot be edited this way.");

            var line = order.Lines.Single();
            var previousTourDate = line.TourDate;
            var previousGuestCount = line.GuestCount;

            line.TourDate = tourDate;
            line.GuestCount = guestCount;

            await new OrderValidationService([order], Context).ValidateEntitiesAsync();

            // Пересчёт от того же снапшота цены: правка гостей не должна переоценивать тур
            // по текущей цене (снапшот фиксируется один раз, на создании — ADR 019).
            line.LineTotal = ResolveTotalAmount(line);

            await EntityRepository.SaveChangesAsync(cancellationToken);

            return new OrderUpdateResult
            {
                PreviousTourDate = previousTourDate,
                PreviousGuestCount = previousGuestCount,
                CurrentTourDate = line.TourDate,
                CurrentGuestCount = line.GuestCount
            };
        }

        // Пересчёт итога строки после правки даты/гостей. Формула — общая
        // (OrderLinePricing), собственной копии тарифных ступеней у этого сервиса больше нет
        // (батч «Трансферы + формат», 2026-08-29): с групповым форматом и трансфером
        // разошедшиеся копии дали бы клиенту одну цену при бронировании и другую после
        // правки той же брони.
        //
        // Скидка НЕ перерезолвится: и процент, и базовая цена — снапшоты момента брони
        // (ADR 019). Меняется только то, что зависит от числа гостей.
        private static decimal ResolveTotalAmount(OrderLine line)
        {
            // Кастомная заявка: цену проставил менеджер вручную, пересчитывать её не по чему
            // (базовой цены продукта у заявки нет). Сюда доехать нельзя — заказ-заявка не в
            // статусе Open/PendingPayment — но правило важнее, чем текущая недостижимость.
            if (line.LineKind == OrderLineKind.CustomTransfer)
                return line.LineTotal;

            // Трансфер: цена — это цена класса авто за машину. Ни гости, ни дата на неё не
            // влияют, значит и пересчитывать нечего.
            if (line.VehicleClassId is not null)
                return line.LineTotal;

            var discounted = TourDiscountExtensions.ApplyDiscount(line.PriceSnapshot, line.DiscountPercent)
                             ?? line.PriceSnapshot;

            // Формат берётся со строки-снапшота, а не из текущего состояния продукта: смена
            // формата в карточке тура не должна переоценивать уже оформленные брони. null —
            // строка, созданная до появления формата, то есть индивидуальная.
            return OrderLinePricing.ResolveLineTotal(line.Format ?? TourFormat.Individual, discounted, line.GuestCount);
        }
    }

    public class OrderUpdateResult
    {
        public DateOnly PreviousTourDate { get; set; }
        public int PreviousGuestCount { get; set; }
        public DateOnly CurrentTourDate { get; set; }
        public int CurrentGuestCount { get; set; }
    }
}
