using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Денежная часть заказа (ADR 014): отдельная сущность со своим Id и unique-FK на Order,
    // а не плоские колонки в Order и не owned-type (owned-типов в проекте нет ни одного).
    // Точка расширения под платёжный шлюз: провайдер/транзакции/статусы оплаты добавятся
    // сюда, не трогая Order.
    [EntityTypeConfiguration(typeof(OrderPaymentConfiguration))]
    public class OrderPayment : EntityBase
    {
        public int OrderId { get; set; }
        public Order Order { get; set; }

        // Снапшот Tour.TotalPrice на момент заказа (ДО скидки): последующая правка цены тура
        // не должна задним числом менять уже оформленную бронь.
        public decimal TourPriceSnapshot { get; set; }

        // Снапшот процента Discount-тега тура на момент заказа, null — скидки не было.
        // Хранится отдельно от TourPriceSnapshot, чтобы в деталях заказа было видно и
        // исходную цену, и процент, а не только уже посчитанный итог (D-1, 2026-08-16).
        // Последующая правка/удаление тега не меняет задним числом уже оформленную бронь.
        public decimal? DiscountPercent { get; set; }

        // Согласованная сумма заказа (цена со скидкой, если она была * тариф по числу гостей).
        public decimal TotalAmount { get; set; }

        // Предоплата. Шлюза нет — сейчас всегда 0 (см. OrderCreationService.ResolvePrepayment),
        // поле уже готово принять реальную политику предоплаты.
        public decimal PrepaidAmount { get; set; }

        // ISO-4217. Базовая цена на бэке всегда в AMD; мультивалютность — отображение на фронте.
        public string Currency { get; set; }
    }
}
