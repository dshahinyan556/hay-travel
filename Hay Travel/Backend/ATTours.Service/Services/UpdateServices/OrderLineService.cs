using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Availability;
using ATTours.BusinessServices.Services.Shared;
using ATTours.Common.DTO.Init;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
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
    //
    // Батч «Трансферы + формат» (2026-08-29): добавленная админом строка считается по тому же
    // правилу, что и бронь с сайта (OrderLinePricing), и проходит ту же проверку мест
    // группового формата — иначе групповой выезд можно было бы перебронировать из админки в
    // обход решения 0.20.
    //
    // Сознательно НЕ гоняем здесь OrderValidationService целиком: у неё есть правила, которые
    // касаются посетителя, а не админа (прошедший день, закрытая дата, снятый с публикации
    // продукт). Админ вправе завести строку на закрытый день — а вот выдумать цену или сесть
    // на занятое место не вправе. Правила, которые всё-таки общие (тариф, единицы багажа,
    // счёт мест), живут в общих хелперах, а не скопированы сюда.
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

            var tour = await Context.Set<Tour>()
                                    .AsNoTracking()
                                    .Where(x => x.Id == model.TourId)
                                    .Select(x => new TourLineContext
                                    {
                                        Type = x.Type,
                                        Format = x.Format,
                                        TotalPrice = x.TotalPrice,
                                        GroupPricePerPerson = x.GroupPricePerPerson,
                                        GroupCapacity = x.GroupCapacity,
                                        DiscountPercent = x.DiscountPercent,
                                        DiscountStartDate = x.DiscountStartDate,
                                        DiscountValidUntil = x.DiscountValidUntil,
                                        StartTimes = x.StartTimes.Select(startTime => startTime.Time).ToList()
                                    })
                                    .SingleOrDefaultAsync(cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.BadRequest,
                           $"Tour with id {model.TourId} not found.");

            ValidateReturnTrip(model);

            var line = tour.Type == TourType.Transfer
                ? await BuildTransferLineAsync(model, order.Id)
                : await BuildProductLineAsync(model, tour, order.Id);

            order.Lines.Add(line);
            await EntityRepository.SaveChangesAsync(cancellationToken);
            return line;
        }

        // Тур/экскурсия: скидка на дату поездки строки, потом формат/тир — тот же порядок и
        // тот же хелпер, что в OrderCreationService (checklist-discount-fix.txt, баг 2).
        private async Task<OrderLine> BuildProductLineAsync(OrderLineCreateModel model, TourLineContext tour, int orderId)
        {
            var format = OrderLinePricing.ResolveEffectiveFormat(tour.Format, model.Format)
                         ?? throw new ErrorModelException(GlobalErrorCode.OrderLineFormatRequired, HttpStatusCode.BadRequest,
                             $"Format must be specified for tour {model.TourId}.");

            // Слот берётся только из расписания продукта (решение 0.21). Пустой допускается у
            // индивидуального формата — так же, как в валидации брони с сайта: у строк,
            // заведённых до этого батча, времени нет вовсе.
            if (model.StartTime is not null && !tour.StartTimes.Contains(model.StartTime.Value))
                throw new ErrorModelException(GlobalErrorCode.InvalidStartTimeSelection, HttpStatusCode.BadRequest,
                    $"Start time {model.StartTime} is not offered by tour {model.TourId}.");

            if (format == TourFormat.Group)
                await EnsureSeatsAvailableAsync(model, tour);

            var priceSnapshot = OrderLinePricing.ResolveBasePrice(format, tour.TotalPrice, tour.GroupPricePerPerson);
            var discountPercent = TourDiscountExtensions.ResolveActiveDiscountPercent(
                tour.DiscountPercent, tour.DiscountStartDate, tour.DiscountValidUntil, model.TourDate);
            var discounted = TourDiscountExtensions.ApplyDiscount(priceSnapshot, discountPercent) ?? priceSnapshot;

            var line = BuildBaseLine(model, orderId);
            line.Format = format;
            // Обратный рейс бывает только у трансфера: пришедшие поля не сохраняем, иначе на
            // строке тура появился бы «обратный рейс», которого не существует.
            line.IsRoundTrip = false;
            line.ReturnDate = null;
            line.ReturnTime = null;
            line.PriceSnapshot = priceSnapshot;
            line.DiscountPercent = discountPercent;
            line.LineTotal = OrderLinePricing.ResolveLineTotal(format, discounted, model.GuestCount);

            return line;
        }

        // Предопределённый трансфер: цена строки — это цена выбранного класса авто, «в одну
        // сторону» или «туда-обратно» (решение 0.6). Скидки и тиры не применяются.
        private async Task<OrderLine> BuildTransferLineAsync(OrderLineCreateModel model, int orderId)
        {
            if (model.StartTime is null)
                throw new ErrorModelException(GlobalErrorCode.InvalidStartTimeSelection, HttpStatusCode.BadRequest,
                    $"Pickup time is required for transfer {model.TourId}.");

            if (model.VehicleClassId is null)
                throw new ErrorModelException(GlobalErrorCode.VehicleClassNotAvailable, HttpStatusCode.BadRequest,
                    $"Vehicle class is required for transfer {model.TourId}.");

            var price = await Context.Set<TransferPrice>()
                                     .AsNoTracking()
                                     .Where(x => x.TourId == model.TourId && x.VehicleClassId == model.VehicleClassId)
                                     .Select(x => new
                                     {
                                         x.OneWayPrice,
                                         x.RoundTripPrice,
                                         x.VehicleClass.Capacity,
                                         VehicleClassName = x.VehicleClass.Translations
                                                             .OrderBy(translation => translation.LanguageCode == LanguageCode.Russian ? 0 : 1)
                                                             .Select(translation => translation.Value)
                                                             .FirstOrDefault()
                                     })
                                     .SingleOrDefaultAsync(cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.VehicleClassNotAvailable, HttpStatusCode.BadRequest,
                            $"Vehicle class {model.VehicleClassId} is not available for transfer {model.TourId}.");

            if (model.GuestCount > price.Capacity)
                throw new ErrorModelException(GlobalErrorCode.PassengersExceedVehicleCapacity, HttpStatusCode.BadRequest,
                    $"Passenger count {model.GuestCount} exceeds capacity {price.Capacity} of the selected vehicle class.");

            var amount = OrderLinePricing.ResolveTransferLineTotal(price.OneWayPrice, price.RoundTripPrice, model.IsRoundTrip);

            var line = BuildBaseLine(model, orderId);
            line.Format = null;
            line.IsRoundTrip = model.IsRoundTrip;
            line.ReturnDate = model.IsRoundTrip ? model.ReturnDate : null;
            line.ReturnTime = model.IsRoundTrip ? model.ReturnTime : null;
            line.VehicleClassId = model.VehicleClassId;
            line.VehicleClassNameSnapshot = price.VehicleClassName;
            line.PriceSnapshot = amount;
            line.DiscountPercent = null;
            line.LineTotal = amount;

            return line;
        }

        private static OrderLine BuildBaseLine(OrderLineCreateModel model, int orderId)
            => new()
            {
                OrderId = orderId,
                LineKind = OrderLineKind.Product,
                TourId = model.TourId,
                TourDate = model.TourDate,
                StartTime = model.StartTime,
                GuestCount = model.GuestCount,
                RequiresPrepayment = model.RequiresPrepayment,
                PrepaymentAmount = model.PrepaymentAmount
            };

        // Места группового формата (решение 0.20). Собственные строки заказа НЕ исключаются:
        // добавляется новая бронь, а те, что уже есть в заказе, место занимают по-настоящему.
        private async Task EnsureSeatsAvailableAsync(OrderLineCreateModel model, TourLineContext tour)
        {
            if (model.StartTime is null)
                throw new ErrorModelException(GlobalErrorCode.InvalidStartTimeSelection, HttpStatusCode.BadRequest,
                    $"Start time is required for the group format of tour {model.TourId}.");

            var capacity = tour.GroupCapacity ?? 0;
            var booked = await GroupSeatsCalculator.GetBookedSeatsAsync(Context, model.TourId, model.TourDate,
                model.StartTime.Value, excludeOrderId: 0, cancellationToken);

            if (booked + model.GuestCount > capacity)
                throw new ErrorModelException(GlobalErrorCode.NoSeatsLeft, HttpStatusCode.BadRequest,
                    $"Only {GroupSeatsCalculator.ResolveSeatsLeft(capacity, booked)} seats left for tour {model.TourId} " +
                    $"on {model.TourDate:yyyy-MM-dd} {model.StartTime}.");

        }

        // Зеркало правила из OrderValidationService: обратный рейс имеет свою дату и своё
        // время и не может начинаться раньше самой поездки.
        private static void ValidateReturnTrip(OrderLineCreateModel model)
        {
            if (!model.IsRoundTrip)
                return;

            var invalid = model.ReturnDate is null
                          || model.ReturnTime is null
                          || model.ReturnDate < model.TourDate
                          || (model.ReturnDate == model.TourDate && model.StartTime is not null && model.ReturnTime < model.StartTime);

            if (invalid)
                throw new ErrorModelException(GlobalErrorCode.InvalidReturnTrip, HttpStatusCode.BadRequest,
                    "Return trip requires a date and time not earlier than the outbound trip.");
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
                LineKind = line.LineKind,
                // null у строки-заявки: продукта у неё нет. Журнал по этому и различает
                // «Удалена строка: «Тур ...»» и «Удалена строка: «Кастомный трансфер»».
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

            ApplyManualLineTotal(line, model);

            await Context.SaveChangesAsync(cancellationToken);
        }

        // Цена кастомной заявки (решение 0.11): она приходит без суммы, и проставить её может
        // только менеджер. На строке по продукту сумма — снапшот расчёта (ADR 019), поэтому
        // попытка переписать её руками отбивается, а не игнорируется молча: тихо
        // проигнорированное поле — это админ, уверенный, что цену он поменял.
        private static void ApplyManualLineTotal(OrderLine line, OrderLineUpdateModel model)
        {
            if (model.LineTotal is null)
                return;

            if (line.LineKind != OrderLineKind.CustomTransfer)
                throw new ErrorModelException(GlobalErrorCode.OrderNotEditable, HttpStatusCode.BadRequest,
                    $"Line total of order line {line.Id} is calculated from the product and cannot be set manually.");

            if (model.LineTotal < 0)
                throw new ErrorModelException(GlobalErrorCode.OrderNotEditable, HttpStatusCode.BadRequest,
                    "Line total cannot be negative.");

            line.LineTotal = model.LineTotal.Value;
            // Снапшот заявки идёт следом за согласованной ценой: у неё нет «цены продукта»,
            // от которой он мог бы отличаться, а пустой снапшот при непустом итоге выглядел
            // бы в гриде как бесплатная строка.
            line.PriceSnapshot = model.LineTotal.Value;
        }

        // Поля продукта, нужные расчёту и проверкам строки. Проекция, а не сущность: граф
        // тура с переводами и днями админскому «+ Добавить строку» ни к чему.
        private sealed class TourLineContext
        {
            public TourType Type { get; set; }
            public TourFormat? Format { get; set; }
            public decimal? TotalPrice { get; set; }
            public decimal? GroupPricePerPerson { get; set; }
            public int? GroupCapacity { get; set; }
            public decimal? DiscountPercent { get; set; }
            public DateOnly? DiscountStartDate { get; set; }
            public DateOnly? DiscountValidUntil { get; set; }
            public List<TimeOnly> StartTimes { get; set; } = [];
        }
    }

    public class OrderLineRemovedResult
    {
        public int OrderId { get; set; }

        // Тип удалённой строки — журналу нужно знать, писать ли название тура или «кастомный
        // трансфер», а не выводить это из отсутствия TourId.
        public OrderLineKind LineKind { get; set; }

        // null у строки-заявки (2026-08-29): продукта у неё нет.
        public int? TourId { get; set; }

        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
    }
}
