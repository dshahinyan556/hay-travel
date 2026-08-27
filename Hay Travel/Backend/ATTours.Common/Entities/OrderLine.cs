using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Одна бронь одного тура на одну дату внутри заказа (переделка B14, 2026-08-16: Order
    // стал шапкой, вся бронь/деньги/исполнитель живут на строке). Бронь с сайта создаёт Order
    // с РОВНО одной строкой; несколько строк на одном заказе — админ добавляет вручную
    // (checklist-orders-redesign.txt, Фаза 1) — по факту редкость.
    [EntityTypeConfiguration(typeof(OrderLineConfiguration))]
    public class OrderLine : EntityBase
    {
        public int OrderId { get; set; }
        public Order Order { get; set; }

        public int TourId { get; set; }
        public Tour Tour { get; set; }

        // Календарный день брони. DateOnly, не DateTime — см. Order (было) / ADR 012.
        public DateOnly TourDate { get; set; }

        public int GuestCount { get; set; }

        // Показывать ли блок предоплаты по ЭТОЙ строке — раньше был Tour.RequiresPrepayment
        // (per-tour), теперь ещё и решение по конкретной брони (сумма ниже может быть 0, даже
        // если тур в принципе требует предоплату — сумму согласовывает админ).
        public bool RequiresPrepayment { get; set; }
        public decimal PrepaymentAmount { get; set; }

        // Снапшоты на момент создания строки — правка цены/скидки тура задним числом не
        // трогает уже оформленную бронь (тот же принцип, что был у OrderPayment до ADR 015).
        public decimal PriceSnapshot { get; set; }
        public decimal? DiscountPercent { get; set; }
        // Итог по строке: PriceSnapshot со скидкой и групповым тарифом — тот же расчёт, что
        // раньше жил в OrderCreationService/OrderPayment.TotalAmount.
        public decimal LineTotal { get; set; }

        // Исполнители строки (0..N). Пустая коллекция — строка не назначена (редизайн
        // 2026-08-23: плоские EmployeeId/EmployeeRole/PickupDetails/NavigatorLink уехали
        // на OrderLineEmployee, у каждого исполнителя своя роль и свои детали).
        public HashSet<OrderLineEmployee> Employees { get; set; } = [];

        public HashSet<OrderPayment> Payments { get; set; } = [];
    }
}
