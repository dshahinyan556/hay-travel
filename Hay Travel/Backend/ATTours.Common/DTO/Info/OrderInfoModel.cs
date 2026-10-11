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

        // Chat id клиента — по той же причине, что и язык: резолверу получателя «Клиент
        // заказа» он нужен на платформе Telegram, а второго похода в БД на отправке нет.
        // null — клиент не проходил /start; отсекается на отправке, с логом.
        public long? UserTelegramChatId { get; set; }

        public OrderStatus Status { get; set; }
        public string RejectReason { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? ApprovedAtUtc { get; set; }
        public string Currency { get; set; }

        public List<OrderLineInfoModel> Lines { get; set; } = [];

        // Контакты для связи, ОСНОВНОЙ ПЕРВЫМ (порядок задаёт маппинг, фронт не сортирует).
        // Пустой список у заказов, созданных до батча 2026-08-29 — их не бэкфиллили.
        public List<OrderContactInfoModel> Contacts { get; set; } = [];

        // Агрегаты по строкам, посчитанные в мапере — фронту не нужно суммировать грид самому
        // на КАЖДОМ рендере деталей заказа (см. summary-strip мокапа).
        public decimal DiscountTotal { get; set; }
        public decimal Total { get; set; }
    }
}
