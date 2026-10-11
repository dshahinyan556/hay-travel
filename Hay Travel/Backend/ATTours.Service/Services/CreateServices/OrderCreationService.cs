using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.BusinessServices.Services.Shared;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.DTO.Init;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.CreateServices
{
    // Создание брони с публичного сайта — чекаут корзины (ADR 025): весь чекаут это ОДИН
    // заказ с N строками, даже если позиция одна. Атомарность даётся строением агрегата, а не
    // внешней транзакцией: EnrichAsync собирает Order со всеми Lines в коллекции, валидация
    // бросает ДО сохранения, а EntityActionServiceBase делает ровно один SaveChangesAsync —
    // одна неявная транзакция EF, строки уезжают каскадом. Никаких циклов «N сервисов /
    // N SaveChanges»: они ломают атомарность и превращают одну заявку в N заказов.
    //
    // Доменная логика (владелец, снапшот цены, номер, начальный статус) живёт здесь, а не в
    // контроллере и не в маппере.
    public class OrderCreationService : CreateVerifiableEntityBase<Order, ATToursContextFactory>
    {
        // Валюта базовой цены на бэке всегда AMD (мультивалютность — отображение на фронте).
        private const string BaseCurrency = "AMD";

        // Тарифные ступени переехали в OrderLinePricing (батч «Трансферы + формат»,
        // 2026-08-29): с групповым форматом и трансфером правило расчёта строки стало общим
        // для создания брони, правки её клиентом и добавления строки админом — три копии
        // формулы разъехались бы гарантированно.

        private readonly int userId;
        private readonly List<OrderCreateLineModel> lines;
        private readonly List<OrderContactCreateModel> contacts;

        // Принимается модель целиком, а не отдельные списки (батч «Контакты», 2026-08-29):
        // у сервиса два конструктора, и второй позиционный List<...> рядом с первым был бы
        // приглашением перепутать их местами.
        public OrderCreationService(OrderCreateModel model, int userId, CancellationToken cancellationToken = default)
            : base(new Order(), CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
            this.userId = userId;
            this.lines = model?.Lines ?? [];
            this.contacts = model?.Contacts ?? [];
        }

        public OrderCreationService(OrderCreateModel model, int userId, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(new Order(), context, cancellationToken)
        {
            this.userId = userId;
            this.lines = model?.Lines ?? [];
            this.contacts = model?.Contacts ?? [];
        }

        protected override IEntityValidation GetEntityValidation()
        {
            // PerLine: отказ чекаута должен назвать КАЖДУЮ плохую позицию корзины, а не первую
            // попавшуюся (ADR 025, развилка Р3).
            return new OrderValidationService(Entities, Context, OrderValidationReporting.PerLine);
        }

        // Обогащение идёт ДО валидации и сохранения: валидация обязана видеть уже
        // проставленные серверные поля, а не то, что прислал клиент.
        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            await EnrichAsync();
            await base.ExecuteEntityChangesFactoryAsync();
        }

        private async Task EnrichAsync()
        {
            var order = Entities.Single();

            order.UserId = userId;
            order.Currency = BaseCurrency;
            order.CreatedAtUtc = DateTime.UtcNow;
            order.Number = await OrderNumberGenerator.GenerateAsync(Context, order.CreatedAtUtc, CancellationToken);

            var tourPricing = await LoadTourPricingAsync();
            var transferPricing = await LoadTransferPricingAsync();

            // Порядок строк сохраняется как в запросе: индекс строки = позиция корзины на
            // клиенте, и по нему же собирается пер-строчный отчёт об ошибке.
            foreach (var requestedLine in lines)
                order.Lines.Add(BuildLine(requestedLine, tourPricing, transferPricing));

            // Контакты — снимок значений (ADR 032). Отказ при 0/>3/не-одном основном
            // принимает OrderValidationService, здесь только сборка.
            foreach (var contact in OrderContactBuilder.Build(contacts))
                order.Contacts.Add(contact);

            // Флоу заказов (B12, дополнено B14): Open, если ни одна строка не требует
            // предоплаты; иначе PendingPayment. Бронь с сайта сейчас никогда сама не просит
            // предоплату (RequiresPrepayment ставится только вручную админом), поэтому всегда
            // Open — но правило пишется по факту строк, а не хардкодом, чтобы не сломаться,
            // когда админ начнёт требовать предоплату уже при создании.
            order.Status = order.Lines.Any(line => line.RequiresPrepayment) ? OrderStatus.PendingPayment : OrderStatus.Open;
        }

        // Цены/скидки всех упомянутых туров ОДНИМ запросом, а не по запросу на строку:
        // чекаут корзины — до 10 позиций (OrderLimits.MaxOrderLines), N+1 здесь недопустим.
        // Дубли TourId (тот же тур на разные даты — легальный сценарий) схлопываются
        // Distinct, снапшот резолвится из словаря на дату каждой строки.
        private async Task<Dictionary<int, TourPricing>> LoadTourPricingAsync()
        {
            var tourIds = lines.Select(line => line.TourId).Distinct().ToList();
            if (tourIds.Count == 0)
                return [];

            return await Context.Set<Tour>()
                                .Where(tour => tourIds.Contains(tour.Id))
                                .Select(tour => new TourPricing(tour.Id, tour.Type, tour.Format, tour.TotalPrice,
                                    tour.GroupPricePerPerson, tour.DiscountPercent,
                                    tour.DiscountStartDate, tour.DiscountValidUntil))
                                .ToDictionaryAsync(pricing => pricing.TourId, CancellationToken);
        }

        // Цены трансферов по классам авто — тем же одним запросом и по той же причине
        // (батч 2026-08-29). Название класса берётся здесь же: на строке оно живёт снапшотом,
        // и добирать его потом отдельным запросом было бы вторым походом в БД за уже
        // прочитанной таблицей. RU, иначе любой оставшийся — то же правило, что у названия
        // тура в журнале заказа.
        private async Task<Dictionary<(int TourId, int VehicleClassId), TransferPricing>> LoadTransferPricingAsync()
        {
            // Только позиции с выбранным классом авто: корзина без трансферов (подавляющее
            // большинство чекаутов) не платит за этот запрос вовсе.
            var tourIds = lines.Where(line => line.VehicleClassId is not null)
                               .Select(line => line.TourId)
                               .Distinct()
                               .ToList();
            if (tourIds.Count == 0)
                return [];

            var prices = await Context.Set<TransferPrice>()
                                      .Where(price => tourIds.Contains(price.TourId))
                                      .Select(price => new TransferPricing(price.TourId, price.VehicleClassId,
                                          price.OneWayPrice, price.RoundTripPrice,
                                          price.VehicleClass.Translations
                                               .OrderBy(translation => translation.LanguageCode == LanguageCode.Russian ? 0 : 1)
                                               .Select(translation => translation.Value)
                                               .FirstOrDefault()))
                                      .ToListAsync(CancellationToken);

            return prices.ToDictionary(price => (price.TourId, price.VehicleClassId));
        }

        private static OrderLine BuildLine(OrderCreateLineModel requestedLine, IReadOnlyDictionary<int, TourPricing> tourPricing,
            IReadOnlyDictionary<(int TourId, int VehicleClassId), TransferPricing> transferPricing)
        {
            // Снапшот цены и скидки тура на момент заказа: последующая правка цены/скидки
            // тура не должна менять уже оформленную бронь. Тур может не существовать — это
            // отобьёт валидация (TourNotFound), здесь просто берём 0/null и не падаем NRE.
            tourPricing.TryGetValue(requestedLine.TourId, out var pricing);

            var line = new OrderLine
            {
                LineKind = OrderLineKind.Product,
                TourId = requestedLine.TourId,
                TourDate = requestedLine.TourDate,
                StartTime = requestedLine.StartTime,
                GuestCount = requestedLine.GuestCount,
                IsRoundTrip = requestedLine.IsRoundTrip,
                ReturnDate = requestedLine.IsRoundTrip ? requestedLine.ReturnDate : null,
                ReturnTime = requestedLine.IsRoundTrip ? requestedLine.ReturnTime : null,
                RequiresPrepayment = false,
                PrepaymentAmount = 0m
            };

            if (pricing?.Type == TourType.Transfer)
                ApplyTransferPricing(line, requestedLine, transferPricing);
            else
                ApplyProductPricing(line, requestedLine, pricing);

            return line;
        }

        // Трансфер: цена — это цена выбранного класса авто, «в одну сторону» или
        // «туда-обратно» (решение 0.6). Тиры и скидка не применяются: скидка у трансфера
        // запрещена валидацией продукта, а число гостей на цену не влияет — платят за машину.
        // Класса может не быть — отобьёт валидация (VehicleClassNotAvailable), здесь 0.
        private static void ApplyTransferPricing(OrderLine line, OrderCreateLineModel requestedLine,
            IReadOnlyDictionary<(int TourId, int VehicleClassId), TransferPricing> transferPricing)
        {
            TransferPricing? price = null;
            if (requestedLine.VehicleClassId is not null)
                transferPricing.TryGetValue((requestedLine.TourId, requestedLine.VehicleClassId.Value), out price);

            var amount = price is null
                ? 0m
                : OrderLinePricing.ResolveTransferLineTotal(price.OneWayPrice, price.RoundTripPrice, requestedLine.IsRoundTrip);

            line.Format = null;
            line.VehicleClassId = requestedLine.VehicleClassId;
            line.VehicleClassNameSnapshot = price?.VehicleClassName;
            line.PriceSnapshot = amount;
            line.DiscountPercent = null;
            line.LineTotal = amount;
        }

        // Тур/экскурсия. Порядок операций прежний и обязательный: СКИДКА на дату поездки,
        // потом формат/тир (checklist-discount-fix.txt, баг 2) — бронь, оформленная в
        // последний день акции на поездку через месяц, скидку получать не должна.
        //
        // Формат уезжает на строку снапшотом ВСЕГДА, а не только когда продукт продаётся в
        // обоих: по нему потом считает правку брони OrderUpdateService и агрегат скидки в
        // маппере, и «какой тариф применили» не должно зависеть от того, что сейчас стоит
        // у продукта. null здесь означает «клиент не выбрал, хотя был обязан» — строку
        // отобьёт валидация (OrderLineFormatRequired), считать по индивидуальному молча нельзя.
        private static void ApplyProductPricing(OrderLine line, OrderCreateLineModel requestedLine, TourPricing? pricing)
        {
            var format = OrderLinePricing.ResolveEffectiveFormat(pricing?.Format, requestedLine.Format);

            var discountPercent = TourDiscountExtensions.ResolveActiveDiscountPercent(
                pricing?.DiscountPercent, pricing?.DiscountStartDate, pricing?.DiscountValidUntil, requestedLine.TourDate);

            var basePrice = OrderLinePricing.ResolveBasePrice(format ?? TourFormat.Individual,
                pricing?.TotalPrice, pricing?.GroupPricePerPerson);
            var discountedPrice = TourDiscountExtensions.ApplyDiscount(basePrice, discountPercent) ?? basePrice;

            line.Format = format;
            line.PriceSnapshot = basePrice;
            line.DiscountPercent = discountPercent;
            line.LineTotal = format is null
                ? 0m
                : OrderLinePricing.ResolveLineTotal(format.Value, discountedPrice, requestedLine.GuestCount);
        }

        // Проекция ценовых полей тура — ровно то, что нужно снапшоту строки, без вытаскивания
        // всего графа тура с переводами.
        private sealed record TourPricing(int TourId, TourType Type, TourFormat? Format, decimal? TotalPrice,
            decimal? GroupPricePerPerson, decimal? DiscountPercent,
            DateOnly? DiscountStartDate, DateOnly? DiscountValidUntil);

        // Цена одного класса авто на одном трансфере + название класса для снапшота строки.
        private sealed record TransferPricing(int TourId, int VehicleClassId, decimal OneWayPrice,
            decimal RoundTripPrice, string? VehicleClassName);
    }
}
