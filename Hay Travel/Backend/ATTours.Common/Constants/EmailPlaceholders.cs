using ATTours.Common.Enums;

namespace ATTours.Common.Constants
{
    // Код-реестр шаблонов писем заказов (Задача E, §E.4): какие токены доступны в каком
    // письме + человекочитаемая подпись раздела. В БД лежит только то, что редактирует
    // админ (IsEnabled/Subject/BodyHtml) — состав токенов задаёт код, ровно как состав
    // ключей настроек задаёт SiteSettingCatalog (ADR 002).
    //
    // Синтаксис токена — {{PascalCaseName}}, регистрозависимо. Значения подставляются как
    // ТЕКСТ и HTML-кодируются при рендере; исключение — HTML-токены, которые бэкенд строит
    // сам как безопасную разметку: их два — AssignmentDetails и OrderLines.
    public static class EmailPlaceholders
    {
        public const string OrderNumber = nameof(OrderNumber);
        public const string TourTitle = nameof(TourTitle);
        public const string TourDate = nameof(TourDate);
        public const string GuestCount = nameof(GuestCount);
        public const string ClientName = nameof(ClientName);
        public const string ClientEmail = nameof(ClientEmail);
        public const string EmployeeName = nameof(EmployeeName);
        public const string EmployeeRole = nameof(EmployeeRole);
        public const string AssignmentDetails = nameof(AssignmentDetails);

        // Все строки заказа списком (ADR 025): бронь с сайта перестала быть однострочной,
        // и плоские TourTitle/TourDate/GuestCount показывают только первую позицию. Шаблон
        // order.created правит админ — код лишь предоставляет токен.
        public const string OrderLines = nameof(OrderLines);

        // Только реально выводимые в месте отправки токены: то, чего в точке вызова нет,
        // в шаблоне отрендерилось бы пустой строкой и выглядело бы как баг.
        private static readonly IReadOnlyDictionary<EmailActionKey, string[]> TokensByKey =
            new Dictionary<EmailActionKey, string[]>
            {
                [EmailActionKey.OrderCreated] =
                    [OrderNumber, TourTitle, TourDate, GuestCount, OrderLines, ClientName, ClientEmail],
                [EmailActionKey.OrderAssignEmployee] =
                    [OrderNumber, EmployeeName, EmployeeRole, AssignmentDetails],
                [EmailActionKey.OrderUnassignEmployee] =
                    [OrderNumber, EmployeeName, EmployeeRole],
                [EmailActionKey.OrderSendToClient] =
                    [OrderNumber, ClientName]
            };

        private static readonly IReadOnlyDictionary<EmailActionKey, string> DisplayNames =
            new Dictionary<EmailActionKey, string>
            {
                [EmailActionKey.OrderCreated] = "Новая бронь с сайта",
                [EmailActionKey.OrderAssignEmployee] = "Назначение исполнителя",
                [EmailActionKey.OrderUnassignEmployee] = "Снятие исполнителя",
                [EmailActionKey.OrderSendToClient] = "Отправка заказа клиенту"
            };

        // RecipientDescriptions удалены (редизайн 2026-08-23): описание получателя больше не
        // константа кода — получатели настраиваются админом и видны в гриде.

        public static IReadOnlyList<EmailActionKey> AllKeys => [.. TokensByKey.Keys];

        public static bool IsKnown(EmailActionKey key) => TokensByKey.ContainsKey(key);

        // Голые имена токенов — ими рендерер сверяет найденное в шаблоне {{...}}.
        public static IReadOnlyList<string> TokensFor(EmailActionKey key)
            => TokensByKey.TryGetValue(key, out var tokens) ? tokens : [];

        // Готовые к вставке токены для редактора в админке — уже в фигурных скобках.
        public static List<string> WrappedTokensFor(EmailActionKey key)
            => [.. TokensFor(key).Select(Wrap)];

        public static string DisplayName(EmailActionKey key)
            => DisplayNames.TryGetValue(key, out var name) ? name : key.ToString();

        public static string Wrap(string token) => "{{" + token + "}}";
    }
}
