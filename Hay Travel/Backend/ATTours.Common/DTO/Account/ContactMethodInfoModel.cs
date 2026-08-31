using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Account
{
    // Строка справочника способов связи в личном кабинете.
    public class ContactMethodInfoModel
    {
        public int Id { get; set; }
        public ContactMethodType Type { get; set; }
        public string Value { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public bool IsPrimary { get; set; }
    }
}
