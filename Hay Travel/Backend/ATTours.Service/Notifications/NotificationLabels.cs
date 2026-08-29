using ATTours.Common.Enums;
using System.Globalization;

namespace ATTours.BusinessServices.Notifications
{
    // Подписи полей в блоках, которые бэкенд строит сам ({{AssignmentDetails}} и
    // {{OrderLines}}). Раз разметку собирает код, то и её подписи обязаны быть на языке
    // письма — иначе англоязычный получатель увидит «Тур:» посреди английского текста.
    //
    // Статический словарь по образцу EmployeeJobRoleExtensions: набор закрыт, DI не нужен,
    // полноценная ресурсная локализация ради семи слов была бы избыточна.
    public static class NotificationLabels
    {
        private static readonly CultureInfo RussianCulture = new("ru-RU");
        private static readonly CultureInfo EnglishCulture = new("en-US");

        private static readonly IReadOnlyDictionary<string, string> Russian =
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                [Tour] = "Тур",
                [Date] = "Дата",
                [Guests] = "гостей",
                [Pickup] = "Место встречи",
                [Navigator] = "Навигатор",
                [Comment] = "Комментарий",
                [Role] = "Роль",
                [Order] = "Заказ"
            };

        // Заголовок Telegram-уведомления по событию (ADR 031 §2): у Telegram шаблона в
        // модели нет, текст собирает бэкенд, значит и заголовок живёт в коде.
        //
        // Формулировки нейтральные (не «вас назначили»): одно и то же событие уходит и
        // персонально исполнителю, и общим получателям (админам), а разводить два набора
        // заголовков ради одной строки — лишняя развилка.
        private static readonly IReadOnlyDictionary<EmailActionKey, string> RussianEventTitles =
            new Dictionary<EmailActionKey, string>
            {
                [EmailActionKey.OrderCreated] = "Новая бронь",
                [EmailActionKey.OrderAssignEmployee] = "Назначение исполнителя",
                [EmailActionKey.OrderUnassignEmployee] = "Снятие исполнителя",
                [EmailActionKey.OrderSendToClient] = "Документы заказа",
                [EmailActionKey.OrderAutoCancelled] = "Бронь отменена автоматически"
            };

        private static readonly IReadOnlyDictionary<EmailActionKey, string> EnglishEventTitles =
            new Dictionary<EmailActionKey, string>
            {
                [EmailActionKey.OrderCreated] = "New booking",
                [EmailActionKey.OrderAssignEmployee] = "Employee assignment",
                [EmailActionKey.OrderUnassignEmployee] = "Employee unassignment",
                [EmailActionKey.OrderSendToClient] = "Order documents",
                [EmailActionKey.OrderAutoCancelled] = "Booking cancelled automatically"
            };

        private static readonly IReadOnlyDictionary<string, string> English =
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                [Tour] = "Tour",
                [Date] = "Date",
                [Guests] = "guests",
                [Pickup] = "Pickup",
                [Navigator] = "Navigator",
                [Comment] = "Comment",
                [Role] = "Role",
                [Order] = "Order"
            };

        public const string Tour = nameof(Tour);
        public const string Date = nameof(Date);
        public const string Guests = nameof(Guests);
        public const string Pickup = nameof(Pickup);
        public const string Navigator = nameof(Navigator);
        public const string Comment = nameof(Comment);
        public const string Role = nameof(Role);
        public const string Order = nameof(Order);

        // Неизвестный токен — пустая строка, а не имя токена: литерал в письме выглядел бы
        // как баг (тот же принцип, что у неизвестного плейсхолдера в рендерере).
        public static string For(string token, LanguageCode language)
        {
            var labels = language == LanguageCode.English ? English : Russian;
            return labels.TryGetValue(token, out var label) ? label : string.Empty;
        }

        // RU — dd.MM.yyyy (как было), EN — dd MMM yyyy: числовой формат даты в английском
        // письме двусмысленен (03.04 это 3 апреля или 4 марта).
        public static string FormatDate(DateOnly date, LanguageCode language)
            => language == LanguageCode.English
                ? date.ToString("dd MMM yyyy", EnglishCulture)
                : date.ToString("dd.MM.yyyy", RussianCulture);

        // Неизвестное событие — пустая строка, по тому же правилу, что и неизвестный токен
        // подписи: заголовок просто не печатается, а не показывает имя enum-значения.
        public static string EventTitle(EmailActionKey key, LanguageCode language)
        {
            var titles = language == LanguageCode.English ? EnglishEventTitles : RussianEventTitles;
            return titles.TryGetValue(key, out var title) ? title : string.Empty;
        }

        public static CultureInfo CultureFor(LanguageCode language)
            => language == LanguageCode.English ? EnglishCulture : RussianCulture;
    }
}
