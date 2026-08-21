using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Одна запись журнала заказа (spec 007). Плоская: автор денормализован в самой строке,
    // Include не нужен. Читается только через GET api/Order/{id}/Events — полем в
    // OrderInfoModel журнал сознательно не едет (ADR 020 §4).
    public class OrderEventInfoModel
    {
        public int Id { get; set; }
        public OrderEventType Type { get; set; }
        public string Description { get; set; }
        public int? ActorUserId { get; set; }
        public string ActorFullName { get; set; }
        public DateTime CreatedAtUtc { get; set; }
    }
}
