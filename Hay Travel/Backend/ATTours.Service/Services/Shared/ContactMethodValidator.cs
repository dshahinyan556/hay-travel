using ATTours.Common.Enums;
using System.Text.RegularExpressions;

namespace ATTours.BusinessServices.Services.Shared
{
    // Единственное место на бэке, где живёт правило «как выглядит корректный контакт»
    // (батч 2026-08-29). Им пользуются и справочник профиля
    // (UserContactMethodValidationService), и валидация заказа (OrderValidationService) —
    // иначе две копии регулярок разъедутся, как это уже было с формулой цены строки до
    // появления OrderLinePricing.
    //
    // Зеркалит фронтовую валидацию формы, но не заменяется ею: фронтовая — это UX,
    // эта — защита от прямого запроса к API.
    public static partial class ContactMethodValidator
    {
        // Приводит значение к каноническому виду ДО валидации и ДО записи в БД.
        // Телефонные способы: убираются пробелы, скобки, дефисы и точки — «+374 (10) 12-34-56»
        // и «+37410123456» это один и тот же номер, и в БД должен лежать один вид.
        // Email: Trim + ToLowerInvariant. Telegram: Trim, регистр @username сохраняется.
        // null/пусто -> string.Empty: «нет значения» отобьёт валидация, а не NRE здесь.
        public static string Normalize(ContactMethodType type, string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return string.Empty;

            var trimmed = value.Trim();

            return type switch
            {
                ContactMethodType.Email => trimmed.ToLowerInvariant(),
                ContactMethodType.Telegram => trimmed.StartsWith('@') ? trimmed : StripPhoneSeparators(trimmed),
                _ => StripPhoneSeparators(trimmed)
            };
        }

        // true, если НОРМАЛИЗОВАННОЕ значение соответствует способу связи. Вызывающий обязан
        // подавать сюда уже нормализованное значение (сервисы создания/правки это делают) —
        // метод намеренно не нормализует сам, чтобы «прошло валидацию, а в БД легло другое»
        // было невозможно.
        public static bool IsValid(ContactMethodType type, string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return false;

            return type switch
            {
                ContactMethodType.Phone or ContactMethodType.WhatsApp or ContactMethodType.Viber
                    => InternationalPhoneRegex().IsMatch(value),
                ContactMethodType.Email => EmailRegex().IsMatch(value),
                // У Telegram два законных вида значения: @username и номер телефона.
                ContactMethodType.Telegram
                    => TelegramUsernameRegex().IsMatch(value) || InternationalPhoneRegex().IsMatch(value),
                // Значение вне enum: способа связи не существует, значит и значение неверно.
                _ => false
            };
        }

        // Разделители номера. Ведущий «+» СОХРАНЯЕТСЯ и сервером не дописывается:
        // «89261234567» без плюса — это российский междугородний формат, а не «+8...»,
        // и угадывать страну за клиента нельзя (ADR 032). Формат отличается от
        // User.PhoneNumber (там хранится без «+») сознательно.
        private static string StripPhoneSeparators(string value)
            => PhoneSeparatorRegex().Replace(value, string.Empty);

        [GeneratedRegex(@"[\s()\-\.]", RegexOptions.CultureInvariant)]
        private static partial Regex PhoneSeparatorRegex();

        [GeneratedRegex(@"^\+\d{8,15}$", RegexOptions.CultureInvariant)]
        private static partial Regex InternationalPhoneRegex();

        // Намеренно грубее RFC 5322: задача — отсеять мусор, а не доказать доставляемость.
        [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.CultureInvariant)]
        private static partial Regex EmailRegex();

        // Правила Telegram: 5-32 символа, первый — буква, дальше буквы/цифры/подчёркивание.
        [GeneratedRegex(@"^@[A-Za-z][A-Za-z0-9_]{4,31}$", RegexOptions.CultureInvariant)]
        private static partial Regex TelegramUsernameRegex();
    }
}
