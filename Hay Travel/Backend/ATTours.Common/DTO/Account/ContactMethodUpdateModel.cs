using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Account
{
    // Правка своей строки справочника (PUT api/Account/Contacts). Уже созданные заказы это
    // НЕ трогает — там лежит снимок значений (ADR 032 Р1).
    //
    // UserId, как и в ContactMethodCreateModel, отсутствует: строка ищется по паре
    // Id + userId из токена, поэтому чужую этим эндпоинтом не достать.
    public class ContactMethodUpdateModel
    {
        public int Id { get; set; }
        public ContactMethodType Type { get; set; }
        public string Value { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public bool IsPrimary { get; set; }
    }
}
