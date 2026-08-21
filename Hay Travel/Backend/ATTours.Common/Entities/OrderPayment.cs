using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Денежная ПРОВОДКА заказа (ADR 019, заменяет ADR 014 — см. docs/adr/019). Раньше это была
    // 1:1 сущность-снапшот (цена/скидка/итог на момент заказа); переделка B14 (мульти-строчные
    // заказы) забрала эти снапшоты на OrderLine, а OrderPayment стал тем самым журналом
    // проводок, под который ADR 014 изначально резервировал точку расширения — просто раньше,
    // чем ожидался платёжный шлюз, и по форме, которую задал мокап Давида (грид "платежи").
    [EntityTypeConfiguration(typeof(OrderPaymentConfiguration))]
    public class OrderPayment : EntityBase
    {
        // Заказ адресуется ТОЛЬКО через строку (OrderLine.OrderId) — второй прямой FK на Order
        // создал бы два каскадных пути удаления к одной таблице (Order->OrderPayment и
        // Order->OrderLine->OrderPayment), что SQL Server прямо запрещает ("multiple cascade
        // paths"). К какой строке относится проводка — обязательно (мокап: "order line nbr").
        public int OrderLineId { get; set; }
        public OrderLine OrderLine { get; set; }

        public OrderPaymentType Type { get; set; }

        // Автономер вида PP0000000001 (OrderPaymentNumberGenerator, сквозной счётчик — не
        // сбрасывается по дням, в отличие от Order.Number).
        public string Number { get; set; }

        public decimal Amount { get; set; }

        public DateTime CreatedAtUtc { get; set; }
    }
}
