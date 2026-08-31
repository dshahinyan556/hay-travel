namespace ATTours.Common.Constants
{
    // Доменные лимиты контактов (батч 2026-08-29). Вынесены в константы по той же причине,
    // что и OrderLimits: те же числа держит у себя фронт, магические литералы в двух местах
    // гарантированно разъедутся. TS и C# в этом репозитории код не делят.
    public static class ContactLimits
    {
        // Контактов в ОДНОМ заказе. Минимум — 1 (заказ без контакта не принимается),
        // максимум — 3 (решение заказчика).
        public const int MinOrderContacts = 1;
        public const int MaxOrderContacts = 3;

        // Потолок справочника в профиле. Прямого требования заказчика нет — стоит как
        // защита от прямого запроса к API, который наплодит тысячи строк на пользователя.
        public const int MaxProfileContacts = 20;

        // Ширина колонки Value: 254 — максимальная длина адреса e-mail (RFC 5321),
        // остальные способы связи заведомо короче.
        public const int MaxValueLength = 254;

        // Имя/фамилия контакта. 128 — как у User.FirstName/LastName (UserConfiguration).
        public const int MaxNameLength = 128;
    }
}
