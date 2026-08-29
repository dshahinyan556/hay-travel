using ATTours.Common.Enums;

namespace ATTours.BusinessServices.Services.Shared
{
    // Единственное место на бэке, где живёт правило «сколько стоит строка заказа» (батч
    // «Трансферы + формат», 2026-08-29). До него тирный расчёт был скопирован в
    // OrderCreationService и OrderUpdateService — с появлением группового формата и трансфера
    // третья копия гарантированно бы разъехалась.
    //
    // Правило дублирует фронтовый `shared/currency/pricing.ts` (resolveTier/applyGroupTier)
    // и хук useTierPrice: TS и C# в этом репозитории код не делят, а цифра обязана совпадать
    // до копейки. Меняешь тариф здесь — меняй и там.
    //
    // Порядок операций (не переставлять): СКИДКА на дату поездки -> потом формат/тир.
    // Тир умножает уже дисконтированную цену, а не наоборот (checklist-discount-fix.txt).
    public static class OrderLinePricing
    {
        // 1-4 гостя: цена фиксирована за бронь целиком (НЕ умножается на гостей).
        public const int TierBaseMaxGuests = 4;
        // 5-6: та же цена x1.2. 7+: «цена по запросу» — 0, сумму согласовывает менеджер.
        public const int TierSurchargeMaxGuests = 6;
        public const decimal TierSurchargeMultiplier = 1.2m;

        // Формат, по которому реально считается цена строки.
        //
        // null означает «клиент не выбрал, а выбрать был обязан» (продукт продаётся в обоих
        // форматах) — это отказ валидации OrderLineFormatRequired (2046), а не повод молча
        // посчитать по индивидуальному тарифу.
        //
        // У продуктов, созданных до этого батча, Format == null: они считаются
        // индивидуальными — ровно то поведение, которое у них было всегда.
        public static TourFormat? ResolveEffectiveFormat(TourFormat? productFormat, TourFormat? requestedFormat)
        {
            if (productFormat == TourFormat.Both)
                return requestedFormat is TourFormat.Individual or TourFormat.Group ? requestedFormat : null;

            return productFormat == TourFormat.Group ? TourFormat.Group : TourFormat.Individual;
        }

        // Базовая цена ДО скидки и ДО формата: за бронь целиком (Individual) либо за одного
        // человека (Group). Она же уезжает в OrderLine.PriceSnapshot — то есть снапшот
        // группового продукта хранит цену за человека, а не итог строки.
        public static decimal ResolveBasePrice(TourFormat effectiveFormat, decimal? totalPrice, decimal? groupPricePerPerson)
            => effectiveFormat == TourFormat.Group ? groupPricePerPerson ?? 0m : totalPrice ?? 0m;

        // Итог строки от УЖЕ дисконтированной базовой цены.
        // Group: цена за человека x гости, без тиров и без «7+ скрыто» (решение 0.18).
        // Individual: историческое поведение один в один (решение 0.17).
        public static decimal ResolveLineTotal(TourFormat effectiveFormat, decimal discountedBasePrice, int guestCount)
            => effectiveFormat == TourFormat.Group
                ? discountedBasePrice * Math.Max(guestCount, 0)
                : ApplyTier(discountedBasePrice, guestCount);

        // Тирная наценка индивидуального формата. 7+ — «цена по запросу»: сайт не показывает
        // сумму и не берёт с посетителя обязательство по конкретной цифре.
        public static decimal ApplyTier(decimal price, int guestCount)
        {
            if (guestCount <= TierBaseMaxGuests)
                return price;
            if (guestCount <= TierSurchargeMaxGuests)
                return price * TierSurchargeMultiplier;
            return 0m;
        }

        // Трансфер: цена выбранного класса авто. Ни тиры, ни число гостей, ни скидка к ней не
        // применяются — «туда-обратно» это отдельная цена, а не OneWay x 2 (решение 0.6),
        // и скидка у трансфера запрещена самой валидацией продукта (TransferFieldNotAllowed).
        public static decimal ResolveTransferLineTotal(decimal oneWayPrice, decimal roundTripPrice, bool isRoundTrip)
            => isRoundTrip ? roundTripPrice : oneWayPrice;
    }
}
