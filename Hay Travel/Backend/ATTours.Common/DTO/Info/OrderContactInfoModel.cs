using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Контакт для связи в карточке заказа (админка), «моих заказах» и письме.
    // Порядок списка задаёт сервер: основной первым (см. маппинг Order -> OrderInfoModel).
    public class OrderContactInfoModel
    {
        public int Id { get; set; }
        public ContactMethodType Type { get; set; }
        public string Value { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public bool IsPrimary { get; set; }
        public int SortOrder { get; set; }
    }
}
