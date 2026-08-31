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
    // сам как безопасную разметку: их три — AssignmentDetails, OrderLines и ClientContact.
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

        // Контакты для связи с клиентом (батч 2026-08-29): все контакты заказа, основной
        // первым. HTML-токен — бэкенд строит разметку сам, как OrderLines и AssignmentDetails.
        public const string ClientContact = nameof(ClientContact);

        // Расширение набора Order-полей (Notification Templates, 2026-08-31): раньше набор
        // был мал, хотя у Order полей много — David явно попросил расширить. Оба доступны
        // ВО ВСЕХ 5 письмах (добавлены в каждый TokensByKey ниже) — это общие метаданные
        // заказа, а не деталь конкретного события, как EmployeeName/AssignmentDetails.
        public const string OrderCreatedDate = nameof(OrderCreatedDate);
        public const string OrderCurrency = nameof(OrderCurrency);

        // Раньше заголовок события (NotificationLabels.EventTitle) автоматически
        // подставлялся в начало Telegram-сообщения кодом (BuildTelegramText). Теперь тело
        // Telegram-шаблона, как и Email, полностью авторское — заголовок стал ОБЫЧНЫМ
        // токеном, админ сам решает, вставлять его и куда.
        public const string EventTitle = nameof(EventTitle);

        private static readonly string[] CommonOrderTokens = [OrderCreatedDate, OrderCurrency, EventTitle];

        // Только реально выводимые в месте отправки токены: то, чего в точке вызова нет,
        // в шаблоне отрендерилось бы пустой строкой и выглядело бы как баг.
        private static readonly IReadOnlyDictionary<EmailActionKey, string[]> TokensByKey =
            new Dictionary<EmailActionKey, string[]>
            {
                // ClientContact — главный адресат требования «менеджер не должен гадать,
                // по какому номеру звонить» (ADR 032).
                [EmailActionKey.OrderCreated] =
                    [.. new[] { OrderNumber, TourTitle, TourDate, GuestCount, OrderLines, ClientName, ClientEmail, ClientContact }, .. CommonOrderTokens],

                // ClientContact нужен и исполнителю: водителю/гиду в день выезда звонить
                // клиенту, а телефон аккаунта для этого не годится — заказ мог оформить не
                // тот, с кем нужно связаться.
                [EmailActionKey.OrderAssignEmployee] =
                    [.. new[] { OrderNumber, EmployeeName, EmployeeRole, AssignmentDetails, ClientContact }, .. CommonOrderTokens],

                // ClientContact НЕ выдаётся: снятому исполнителю звонить клиенту уже не нужно.
                [EmailActionKey.OrderUnassignEmployee] =
                    [.. new[] { OrderNumber, EmployeeName, EmployeeRole }, .. CommonOrderTokens],

                // ClientContact НЕ выдаётся: письмо адресовано САМОМУ клиенту, сообщать ему
                // его же контакты незачем.
                [EmailActionKey.OrderSendToClient] =
                    [.. new[] { OrderNumber, ClientName }, .. CommonOrderTokens],

                // Тот же набор, что у OrderCreated: письмо об автоотмене читает тот же
                // админ и о том же заказе — ему нужно узнать бронь, а не выяснять, какое
                // из полей тут отличается от письма о её создании.
                [EmailActionKey.OrderAutoCancelled] =
                    [.. new[] { OrderNumber, TourTitle, TourDate, GuestCount, OrderLines, ClientName, ClientEmail, ClientContact }, .. CommonOrderTokens]
            };

        private static readonly IReadOnlyDictionary<EmailActionKey, string> DisplayNames =
            new Dictionary<EmailActionKey, string>
            {
                [EmailActionKey.OrderCreated] = "Новая бронь с сайта",
                [EmailActionKey.OrderAssignEmployee] = "Назначение исполнителя",
                [EmailActionKey.OrderUnassignEmployee] = "Снятие исполнителя",
                [EmailActionKey.OrderSendToClient] = "Отправка заказа клиенту",
                [EmailActionKey.OrderAutoCancelled] = "Автоотмена неподтверждённой брони"
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

        // Мердж-поля User/Tour/Employee (Notification Templates, 2026-08-31): новые токены,
        // введённые ВМЕСТЕ с полем BoundEntity — сейчас это каталог для «Вставить поле» в
        // редакторе шаблона, а не проверенный набор с рендером на реальной отправке (в
        // отличие от Order-токенов выше, которых касается BuildValues в
        // OrderNotificationService — ни один текущий сценарий отправки не привязан к
        // сущностям User/Tour/Employee напрямую). Если/когда появится реальная рассылка,
        // привязанная к одной из них, рендер для неё пишется по тому же образцу, что и
        // BuildValues.
        public const string UserFullName = nameof(UserFullName);
        public const string UserEmail = nameof(UserEmail);
        public const string UserPhone = nameof(UserPhone);

        public const string TourTitleField = nameof(TourTitleField);
        public const string TourPrice = nameof(TourPrice);
        public const string TourDurationDays = nameof(TourDurationDays);

        public const string EmployeeFullName = nameof(EmployeeFullName);
        public const string EmployeeRoleField = nameof(EmployeeRoleField);
        public const string EmployeePhone = nameof(EmployeePhone);

        private static readonly IReadOnlyDictionary<NotificationTemplateEntity, string[]> TokensByEntity =
            new Dictionary<NotificationTemplateEntity, string[]>
            {
                [NotificationTemplateEntity.None] = [],
                // Полный набор: и общие метаданные заказа, и то, что раньше было раскидано
                // по отдельным событиям (EmployeeName/AssignmentDetails и т.п.) — шаблон
                // теперь переиспользуемый, а не привязанный к одному событию намертво.
                [NotificationTemplateEntity.Order] =
                [
                    OrderNumber, OrderCreatedDate, OrderCurrency, EventTitle, TourTitle, TourDate, GuestCount,
                    OrderLines, ClientName, ClientEmail, ClientContact,
                    EmployeeName, EmployeeRole, AssignmentDetails
                ],
                [NotificationTemplateEntity.User] = [UserFullName, UserEmail, UserPhone],
                [NotificationTemplateEntity.Tour] = [TourTitleField, TourPrice, TourDurationDays],
                [NotificationTemplateEntity.Employee] = [EmployeeFullName, EmployeeRoleField, EmployeePhone]
            };

        // Каталог мердж-полей для редактора шаблона (BoundEntity шаблона -> список токенов,
        // уже в фигурных скобках). None -> пустой список: у auth-писем свой фиксированный
        // набор токенов потока, задаваемый отдельно (см. NotificationAuthPlaceholders).
        public static List<string> ForEntity(NotificationTemplateEntity entity)
            => TokensByEntity.TryGetValue(entity, out var tokens) ? [.. tokens.Select(Wrap)] : [];
    }
}
