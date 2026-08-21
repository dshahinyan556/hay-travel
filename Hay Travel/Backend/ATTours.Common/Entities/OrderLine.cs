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

        // Кто выполняет бронь по этой строке. Nullable — назначается отдельным действием
        // ("Назначить"), не обязателен при создании заказа. FK на User с RoleType.Employee,
        // но на уровне БД это обычный User — enum-проверку роли делает сервис (см. Фазу 2).
        public int? EmployeeId { get; set; }
        public User Employee { get; set; }

        // "Детали для выполнения" (Давид, 2026-08-16): где забрать клиента + ссылка навигатора,
        // на КАЖДУЮ строку отдельно (мульти-строчные заказы редкость, но структура должна их
        // поддерживать). Уходят исполнителю письмом при "Назначить" (Фаза 5.2).
        public string PickupDetails { get; set; }
        public string NavigatorLink { get; set; }

        public HashSet<OrderPayment> Payments { get; set; } = [];
    }
}
