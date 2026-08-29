using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Одна бронь одного тура на одну дату внутри заказа (переделка B14, 2026-08-16: Order
    // стал шапкой, вся бронь/деньги/исполнитель живут на строке). Бронь с сайта создаёт Order
    // с РОВНО одной строкой; несколько строк на одном заказе — админ добавляет вручную
    // (checklist-orders-redesign.txt, Фаза 1) — по факту редкость.
    //
    // Батч «Трансферы + формат» (2026-08-29): строка перестала быть обязательно «строкой по
    // продукту» — кастомный трансфер, собранный клиентом в конструкторе, продукта в каталоге
    // не имеет. Отсюда LineKind и nullable TourId.
    [EntityTypeConfiguration(typeof(OrderLineConfiguration))]
    public class OrderLine : EntityBase
    {
        public int OrderId { get; set; }
        public Order Order { get; set; }

        // Что за строка: обычный продукт (тур/экскурсия/предопределённый трансфер) или
        // кастомная заявка. Различать по «TourId == null» нельзя — тип строки должен быть
        // явным полем, а не побочным эффектом отсутствия FK.
        public OrderLineKind LineKind { get; set; }

        // Nullable с 2026-08-29: null ровно тогда, когда LineKind == CustomTransfer
        // (у заявки нет продукта в каталоге). У Product-строк всегда заполнен.
        public int? TourId { get; set; }
        // Навигация nullable по той же причине (проект собирается с <Nullable>disable</Nullable>,
        // поэтому «?» на ссылочном типе не ставится — необязательность задаёт nullable FK).
        public Tour Tour { get; set; }

        // Календарный день брони. DateOnly, не DateTime — см. Order (было) / ADR 012.
        // У трансфера (обоих видов) это день подачи машины.
        public DateOnly TourDate { get; set; }

        // Выбранное время: у тура/экскурсии — один из слотов Tour.StartTimes (снапшот, а не
        // FK: правка расписания продукта не должна менять уже оформленную бронь), у трансфера
        // — время подачи. Nullable только ради старых строк, созданных до этого батча.
        public TimeOnly? StartTime { get; set; }

        // Формат, выбранный клиентом, когда у продукта Format == Both — снапшот выбора,
        // по нему считался LineTotal. null у трансфера и у старых строк.
        public TourFormat? Format { get; set; }

        // Обратный рейс трансфера. IsRoundTrip == false → обе даты/времени ниже null.
        // У тура/экскурсии всегда false.
        public bool IsRoundTrip { get; set; }
        public DateOnly? ReturnDate { get; set; }
        public TimeOnly? ReturnTime { get; set; }

        // Класс авто трансфера + снапшот его названия (RU) на момент брони — тот же принцип,
        // что у PriceSnapshot: переименование или скрытие класса в справочнике не должно
        // менять то, что клиенту уже подтвердили. Null у тура/экскурсии.
        public int? VehicleClassId { get; set; }
        public VehicleClass VehicleClass { get; set; }
        public string VehicleClassNameSnapshot { get; set; }

        // Детали кастомной заявки (1:1). Заполнены ровно при LineKind == CustomTransfer.
        public CustomTransferDetails CustomTransferDetails { get; set; }

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
