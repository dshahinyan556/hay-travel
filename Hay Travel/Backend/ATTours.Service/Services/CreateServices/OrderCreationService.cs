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

        // Групповой тариф (B12, 2026-08-13) — дублирует правило из `shared/currency/pricing.ts`
        // (`resolveTier`/`applyGroupTier`), которое живёт на фронте. TS и C# не делят код в
        // этом репозитории, а правило должно действовать и здесь. Меняешь тариф — меняй в
        // обоих местах.
        private const int TierBaseMaxGuests = 4;
        private const int TierSurchargeMaxGuests = 6;
        private const decimal TierSurchargeMultiplier = 1.2m;

        private readonly int userId;
        private readonly List<OrderCreateLineModel> lines;

        public OrderCreationService(List<OrderCreateLineModel> lines, int userId, CancellationToken cancellationToken = default)
            : base(new Order(), CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
            this.userId = userId;
            this.lines = lines ?? [];
        }

        public OrderCreationService(List<OrderCreateLineModel> lines, int userId, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(new Order(), context, cancellationToken)
        {
            this.userId = userId;
            this.lines = lines ?? [];
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

            // Порядок строк сохраняется как в запросе: индекс строки = позиция корзины на
            // клиенте, и по нему же собирается пер-строчный отчёт об ошибке.
            foreach (var requestedLine in lines)
                order.Lines.Add(BuildLine(requestedLine, tourPricing));

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
                                .Select(tour => new TourPricing(tour.Id, tour.TotalPrice, tour.DiscountPercent,
                                    tour.DiscountStartDate, tour.DiscountValidUntil))
                                .ToDictionaryAsync(pricing => pricing.TourId, CancellationToken);
        }

        private static OrderLine BuildLine(OrderCreateLineModel requestedLine, IReadOnlyDictionary<int, TourPricing> tourPricing)
        {
            // Снапшот цены и скидки тура на момент заказа: последующая правка цены/скидки
            // тура не должна менять уже оформленную бронь. Тур может не существовать — это
            // отобьёт валидация (TourNotFound), здесь просто берём 0/null и не падаем NRE.
            tourPricing.TryGetValue(requestedLine.TourId, out var pricing);

            var snapshot = pricing?.TotalPrice ?? 0m;
            // Скидка резолвится НА ДАТУ ПОЕЗДКИ, а не на дату оформления (checklist-discount-fix.txt,
            // баг 2): бронь, оформленная в последний день акции на поездку через месяц, скидку
            // получать не должна — и наоборот, заказ внутри диапазона её получает.
            var discountPercent = TourDiscountExtensions.ResolveActiveDiscountPercent(
                pricing?.DiscountPercent, pricing?.DiscountStartDate, pricing?.DiscountValidUntil, requestedLine.TourDate);
            var discountedPrice = TourDiscountExtensions.ApplyDiscount(snapshot, discountPercent) ?? snapshot;

            return new OrderLine
            {
                TourId = requestedLine.TourId,
                TourDate = requestedLine.TourDate,
                GuestCount = requestedLine.GuestCount,
                RequiresPrepayment = false,
                PrepaymentAmount = 0m,
                PriceSnapshot = snapshot,
                DiscountPercent = discountPercent,
                LineTotal = ResolveTotalAmount(discountedPrice, requestedLine.GuestCount)
            };
        }

        // 1–4 гостей: цена (уже со скидкой, если она есть) фиксирована за бронь целиком
        // (НЕ умножается на число гостей). 5–6: та же цена ×1.2. 7+: «цена по запросу» — сайт
        // не показывает сумму и не берёт с посетителя обязательство по конкретной цифре.
        private static decimal ResolveTotalAmount(decimal price, int guestCount)
        {
            if (guestCount <= TierBaseMaxGuests)
                return price;
            if (guestCount <= TierSurchargeMaxGuests)
                return price * TierSurchargeMultiplier;
            return 0m;
        }

        // Проекция ценовых полей тура — ровно то, что нужно снапшоту строки, без вытаскивания
        // всего графа тура с переводами.
        private sealed record TourPricing(int TourId, decimal? TotalPrice, decimal? DiscountPercent,
            DateOnly? DiscountStartDate, DateOnly? DiscountValidUntil);
    }
}
