using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.CreateServices
{
    // Создание брони. Доменная логика заказа (владелец, снапшот цены, статус, платёж)
    // живёт здесь, а не в контроллере и не в маппере: контроллер приносит только то,
    // что пришло из формы, плюс userId из токена.
    public class OrderCreationService : CreateVerifiableEntityBase<Order, ATToursContextFactory>
    {
        // Валюта базовой цены на бэке всегда AMD (мультивалютность — отображение на фронте).
        private const string BaseCurrency = "AMD";

        // Групповой тариф (B12, 2026-08-13) — дублирует правило из `shared/currency/pricing.ts`
        // (`resolveTier`/`applyGroupTier`), которое живёт на фронте и оттуда же и пришло: TS и C#
        // не делят код в этом репозитории, а правило должно действовать и здесь — иначе `TotalAmount`
        // расходится с тем «Итого», что клиент видел на сайте перед бронью (ровно то, о чём
        // предупреждает `OrderInfoModel`). Меняешь тариф — меняй в обоих местах.
        private const int TierBaseMaxGuests = 4;
        private const int TierSurchargeMaxGuests = 6;
        private const decimal TierSurchargeMultiplier = 1.2m;

        private readonly int userId;

        public OrderCreationService(Order entity, int userId, CancellationToken cancellationToken = default)
            : base(entity, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
            this.userId = userId;
        }

        public OrderCreationService(Order entity, int userId, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entity, context, cancellationToken)
        {
            this.userId = userId;
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
            foreach (var entity in Entities)
            {
                // Владелец заказа — только из токена (IDOR-защита по конструкции).
                entity.UserId = userId;

                // Снапшот цены и Discount-тега на момент заказа: последующая правка цены тура
                // или тега не должна менять уже оформленную бронь. Тур может не существовать —
                // это отобьёт валидация (TourNotFound), здесь просто берём 0/null и не падаем NRE.
                // Discount-тег максимум один на тур (TourValidationService), поэтому
                // FirstOrDefault однозначен.
                var tourData = await Context.Set<Tour>()
                                            .Where(tour => tour.Id == entity.TourId)
                                            .Select(tour => new
                                            {
                                                tour.TotalPrice,
                                                DiscountPercent = tour.TourTags
                                                    .Where(tt => tt.Tag.Type == TagType.Discount)
                                                    .Select(tt => (decimal?)tt.Tag.DiscountPercent)
                                                    .FirstOrDefault()
                                            })
                                            .FirstOrDefaultAsync(CancellationToken);

                var snapshot = tourData?.TotalPrice ?? 0m;
                var discountPercent = tourData?.DiscountPercent;
                var discountedPrice = ApplyDiscount(snapshot, discountPercent);

                entity.CreatedAtUtc = DateTime.UtcNow;

                // ЕДИНСТВЕННОЕ место выбора начального статуса. Флоу заказов (B12,
                // 2026-08-13): каждая новая бронь ждёт ручного подтверждения администратором
                // в админке ("Заказы") — сайт больше не подтверждает бронь автоматически.
                entity.Status = OrderStatus.PendingConfirmation;

                entity.Payment = new OrderPayment
                {
                    TourPriceSnapshot = snapshot,
                    DiscountPercent = discountPercent,
                    TotalAmount = ResolveTotalAmount(discountedPrice, entity.GuestCount),
                    PrepaidAmount = ResolvePrepayment(discountedPrice, entity.GuestCount),
                    Currency = BaseCurrency
                };
            }
        }

        // Округление до целого драма — как ResolveTotalAmount ниже, дробных лум на бэке нет.
        private static decimal ApplyDiscount(decimal tourPriceSnapshot, decimal? discountPercent)
        {
            if (discountPercent is null or <= 0)
                return tourPriceSnapshot;

            return Math.Round(tourPriceSnapshot * (1 - discountPercent.Value / 100m), 0, MidpointRounding.AwayFromZero);
        }

        // 1–4 гостей: цена (уже со скидкой, если она есть) фиксирована за бронь целиком
        // (НЕ умножается на число гостей). 5–6: та же цена ×1.2. 7+: «цена по запросу» — сайт
        // не показывает сумму и не берёт с посетителя обязательство по конкретной цифре,
        // поэтому и здесь автоматической суммы нет (0 — админ согласовывает цену отдельно,
        // вне заказа).
        private static decimal ResolveTotalAmount(decimal price, int guestCount)
        {
            if (guestCount <= TierBaseMaxGuests)
                return price;
            if (guestCount <= TierSurchargeMaxGuests)
                return price * TierSurchargeMultiplier;
            return 0m;
        }

        // Seam под будущую политику предоплаты (ADR 014). Платёжного шлюза нет —
        // предоплата это просто число, и сейчас она нулевая.
        private static decimal ResolvePrepayment(decimal price, int guestCount) => 0m;
    }
}
