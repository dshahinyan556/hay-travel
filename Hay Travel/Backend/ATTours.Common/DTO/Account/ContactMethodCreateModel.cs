using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Account
{
    // Новая строка справочника способов связи (POST api/Account/Contacts).
    //
    // UserId в модели НЕТ и быть не должно: владелец всегда берётся из токена
    // (UserContactMethodCreationService), иначе эндпоинт позволял бы завести контакт
    // в чужом профиле.
    public class ContactMethodCreateModel
    {
        public ContactMethodType Type { get; set; }
        public string Value { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }

        // Если справочник пуст, сервер поставит true независимо от присланного значения:
        // профиль без основного контакта нечем предзаполнять форму заказа.
        public bool IsPrimary { get; set; }
    }
}
