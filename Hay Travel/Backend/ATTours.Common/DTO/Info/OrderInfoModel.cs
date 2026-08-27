using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Шапка заказа: чтение и «моих заказов» на публичном сайте, и админского списка/детали
    // (ADR 019 — Order стал мульти-строчным, деньги/тур/дата теперь на Lines).
    public class OrderInfoModel
    {
        public int Id { get; set; }
        public string Number { get; set; }
        public int UserId { get; set; }
        public string UserEmail { get; set; }
        // FirstName + LastName одной строкой.
        public string UserFullName { get; set; }

        // Язык клиента — нужен резолверу получателя "Клиент заказа", чтобы выбрать
        // языковую версию письма без второго похода в БД.
        public LanguageCode UserPreferredLanguage { get; set; }

        public OrderStatus Status { get; set; }
        public string RejectReason { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? ApprovedAtUtc { get; set; }
        public string Currency { get; set; }

        public List<OrderLineInfoModel> Lines { get; set; } = [];

        // Агрегаты по строкам, посчитанные в мапере — фронту не нужно суммировать грид самому
        // на КАЖДОМ рендере деталей заказа (см. summary-strip мокапа).
        public decimal DiscountTotal { get; set; }
        public decimal Total { get; set; }
    }
}
