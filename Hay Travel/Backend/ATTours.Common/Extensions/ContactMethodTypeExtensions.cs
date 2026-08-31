using ATTours.Common.Enums;

namespace ATTours.Common.Extensions
{
    // Подписи способов связи нужны бэкенду ровно для двух вещей — подстановки в письмо
    // ({{ClientContact}}, билингвально) и plaintext-блока Telegram-уведомления.
    // В API подписи не уходят: фронт мапит числа сам (то же правило, что у
    // EmployeeJobRoleExtensions).
    public static class ContactMethodTypeExtensions
    {
        public static string ToLabel(this ContactMethodType type, LanguageCode language)
        {
            if (language == LanguageCode.English)
                return type switch
                {
                    ContactMethodType.Phone => "Phone",
                    ContactMethodType.WhatsApp => "WhatsApp",
                    ContactMethodType.Telegram => "Telegram",
                    ContactMethodType.Viber => "Viber",
                    ContactMethodType.Email => "Email",
                    // Значение вне enum не должно выглядеть как идентификатор.
                    _ => string.Empty
                };

            return type switch
            {
                ContactMethodType.Phone => "Телефон",
                ContactMethodType.WhatsApp => "WhatsApp",
                ContactMethodType.Telegram => "Telegram",
                ContactMethodType.Viber => "Viber",
                ContactMethodType.Email => "E-mail",
                _ => string.Empty
            };
        }
    }
}
