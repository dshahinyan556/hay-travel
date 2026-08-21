using ATTours.Common.Entities;

namespace ATTours.Common.Extensions
{
    // Единая точка резолва скидки тура (Фаза 3, checklist-orders-redesign.txt): активна внутри
    // диапазона [DiscountStartDate; DiscountValidUntil] включительно (checklist-discount-fix.txt).
    // Общий код для MappingProfile (клиентские DTO) и заказных сервисов (OrderCreationService/
    // OrderLineService), которые снапшотят цену на момент брони.
    //
    // Параметр onDate — дата, НА которую проверяется скидка. Для витрины (карточки/детальная)
    // это «сегодня» (значение по умолчанию), для заказа — дата самой поездки (OrderLine.TourDate),
    // а не дата оформления: бронь на день после окончания акции скидку получать не должна.
    public static class TourDiscountExtensions
    {
        public static bool IsDiscountActive(decimal? discountPercent, DateOnly? discountStartDate, DateOnly? discountValidUntil, DateOnly? onDate = null)
        {
            if (discountPercent is not > 0 || discountValidUntil is null)
                return false;

            var date = onDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

            // Нижняя граница необязательна: у строк, созданных до появления DiscountStartDate,
            // она null — это «скидка началась когда-то раньше», а не «скидки нет».
            return discountValidUntil >= date
                   && (discountStartDate is null || discountStartDate <= date);
        }

        public static decimal? ResolveActiveDiscountPercent(this Tour tour, DateOnly? onDate = null)
            => ResolveActiveDiscountPercent(tour.DiscountPercent, tour.DiscountStartDate, tour.DiscountValidUntil, onDate);

        public static decimal? ResolveActiveDiscountPercent(decimal? discountPercent, DateOnly? discountStartDate, DateOnly? discountValidUntil, DateOnly? onDate = null)
            => IsDiscountActive(discountPercent, discountStartDate, discountValidUntil, onDate) ? discountPercent : null;

        // Округление до целого драма — тот же приём, что у OrderLine.LineTotal (дробных лум на бэке нет).
        // Контракт: null означает «скидки нет» (так его читают TourInfoModel.DiscountedPrice,
        // TourCardModel.DiscountedPrice и фронтовый TourCard). Возвращать здесь исходную цену
        // нельзя — тогда любой тур с ценой выглядит скидочным (баг 1, checklist-discount-fix.txt).
        // Вызывающим, которым нужна «цена к оплате», а не «цена со скидкой», следует писать
        // ApplyDiscount(price, percent) ?? price — как это делают заказные сервисы.
        public static decimal? ApplyDiscount(decimal? price, decimal? activeDiscountPercent)
        {
            if (price is null)
                return null;
            if (activeDiscountPercent is null or <= 0)
                return null;

            return Math.Round(price.Value * (1 - activeDiscountPercent.Value / 100m), 0, MidpointRounding.AwayFromZero);
        }
    }
}
