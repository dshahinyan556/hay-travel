using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.BusinessServices.Services.Shared;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.CreateServices
{
    // Создание брони с публичного сайта. Заказ (ADR 019) всегда создаётся с РОВНО одной
    // строкой — многострочные заказы собирает только админ вручную (OrderLineService,
    // checklist-orders-redesign.txt Фаза 1). Доменная логика (владелец, снапшот цены, номер,
    // начальный статус) живёт здесь, а не в контроллере и не в маппере.
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
        private readonly int tourId;
        private readonly DateOnly tourDate;
        private readonly int guestCount;

        public OrderCreationService(int tourId, DateOnly tourDate, int guestCount, int userId, CancellationToken cancellationToken = default)
            : base(new Order(), CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
            this.userId = userId;
            this.tourId = tourId;
            this.tourDate = tourDate;
            this.guestCount = guestCount;
        }

        public OrderCreationService(int tourId, DateOnly tourDate, int guestCount, int userId, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(new Order(), context, cancellationToken)
        {
            this.userId = userId;
            this.tourId = tourId;
            this.tourDate = tourDate;
            this.guestCount = guestCount;
        }

        protected override IEntityValidation GetEntityValidation()
        {
            return new OrderValidationService(Entities, Context);
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

            // Снапшот цены и скидки тура на момент заказа: последующая правка цены/скидки
            // тура не должна менять уже оформленную бронь. Тур может не существовать — это
            // отобьёт валидация (TourNotFound), здесь просто берём 0/null и не падаем NRE.
            var tourData = await Context.Set<Tour>()
                                        .Where(tour => tour.Id == tourId)
                                        .Select(tour => new { tour.TotalPrice, tour.DiscountPercent, tour.DiscountStartDate, tour.DiscountValidUntil })
                                        .FirstOrDefaultAsync(CancellationToken);

            var snapshot = tourData?.TotalPrice ?? 0m;
            // Скидка резолвится НА ДАТУ ПОЕЗДКИ, а не на дату оформления (checklist-discount-fix.txt,
            // баг 2): бронь, оформленная в последний день акции на поездку через месяц, скидку
            // получать не должна — и наоборот, заказ внутри диапазона её получает.
            var discountPercent = TourDiscountExtensions.ResolveActiveDiscountPercent(
                tourData?.DiscountPercent, tourData?.DiscountStartDate, tourData?.DiscountValidUntil, tourDate);
            var discountedPrice = TourDiscountExtensions.ApplyDiscount(snapshot, discountPercent) ?? snapshot;
            var lineTotal = ResolveTotalAmount(discountedPrice, guestCount);

            order.UserId = userId;
            order.Currency = BaseCurrency;
            order.CreatedAtUtc = DateTime.UtcNow;
            order.Number = await OrderNumberGenerator.GenerateAsync(Context, order.CreatedAtUtc, CancellationToken);

            var line = new OrderLine
            {
                TourId = tourId,
                TourDate = tourDate,
                GuestCount = guestCount,
                RequiresPrepayment = false,
                PrepaymentAmount = 0m,
                PriceSnapshot = snapshot,
                DiscountPercent = discountPercent,
                LineTotal = lineTotal
            };
            order.Lines.Add(line);

            // Флоу заказов (B12, дополнено B14): Open, если ни одна строка не требует
            // предоплаты; иначе PendingPayment. Бронь с сайта сейчас никогда сама не просит
            // предоплату (RequiresPrepayment ставится только вручную админом), поэтому всегда
            // Open — но правило пишется по факту строк, а не хардкодом, чтобы не сломаться,
            // когда админ начнёт требовать предоплату уже при создании.
            order.Status = order.Lines.Any(l => l.RequiresPrepayment) ? OrderStatus.PendingPayment : OrderStatus.Open;
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
    }
}
