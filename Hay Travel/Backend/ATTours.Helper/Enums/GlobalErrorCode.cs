using System.ComponentModel;

namespace ATTours.Helper.Enums
{
    public enum GlobalErrorCode
    {
        #region DbExceptions
        [Description("Database error")]
        DatabaseError = 1000,
        [Description("Could not insert duplicate value")]
        OracleDuplicateInsert = 1001,
        [Description("Could not insert duplicate value")]
        DuplicateInsert = 1002,
        [Description("Value too long for type character varying")]
        SqlException = 1003,
        [Description("Concurrency conflict while updating data")]
        PostgresUpdateConcurrencyError = 1004,
        #endregion

        [Description("Request param must have value!")]
        InvalidRequestParam = 101,

        #region EntityErrors

        [Description("Entity Relation Id Is Default")]
        EntityRelationIdIsDefault = 2000,
        [Description("Invalid Entity Relation")]
        InvalidEntityRelation = 2001,
        [Description("Invalid Entity Ids: {0}")]
        InvalidEntityIds = 2002,
        [Description("Relational entity not found.")]
        RelationalEntityNotFound = 2003,
        [Description("Tour not found.")]
        TourNotFound = 2004,
        [Description("Site setting key is unknown.")]
        SiteSettingKeyUnknown = 2005,
        [Description("Region not found.")]
        RegionNotFound = 2006,
        [Description("Place not found.")]
        PlaceNotFound = 2007,
        [Description("Expense template not found.")]
        ExpenseTemplateNotFound = 2008,
        [Description("Tour note template not found.")]
        TourNoteTemplateNotFound = 2009,
        [Description("Catalog entry is in use and cannot be deleted.")]
        CatalogEntryInUse = 2010,
        // Лимит расширен 6 → 9 (решение 0.5 батча «Трансферы + формат», 2026-08-29).
        // Источник правды по числу — TourFeaturedService.MaxFeaturedTours.
        [Description("At most 9 tours can be featured at once.")]
        TooManyFeaturedTours = 2011,
        // Отдаётся только на холодном старте: курс не был сохранён ни разу, и CBA недоступен.
        // Если хоть один курс когда-либо записан, эндпоинт отдаёт его с IsStale = true, а не ошибку.
        [Description("Exchange rates are not available yet.")]
        ExchangeRatesUnavailable = 2012,
        // Значение Select-настройки вне списка допустимых опций каталога
        // (неизвестный id пресета палитры, неизвестный режим темы).
        [Description("Site setting value is not an allowed option.")]
        SiteSettingValueNotAllowed = 2013,
        // Календарь занятости и бронирования (spec 001).
        // Дата закрыта правилом (ADR 012) — серверная блокировка брони на закрытый день.
        [Description("Selected date is not available for booking.")]
        TourDateUnavailable = 2014,
        [Description("Guest count must be at least 1.")]
        InvalidGuestCount = 2015,
        [Description("Order date cannot be in the past.")]
        OrderDateInPast = 2016,
        [Description("Closure rule is invalid.")]
        InvalidClosureRule = 2017,
        // Заказы держат тур по FK Restrict: удалять тур с бронями нельзя.
        [Description("Tour has orders and cannot be deleted.")]
        TourHasOrders = 2018,
        [Description("Order belongs to another user.")]
        OrderAccessForbidden = 2019,
        // Спецификация 001 резервировала под этот код 2013, но к моменту реализации 2013
        // занял SiteSettingValueNotAllowed (параллельная фича), а дублировать значение
        // enum нельзя — коды уходят наружу числом. Сдвинут именно OrderNotFound, потому
        // что остальной блок (2014-2019) уже зашит во фронт (BookingCard, calendarCopy).
        [Description("Order not found.")]
        OrderNotFound = 2020,
        [Description("Order can no longer be edited.")]
        OrderNotEditable = 2021,
        [Description("Date cannot be in the past.")]
        ClosureDateInPast = 2022,
        [Description("Tag not found.")]
        TagNotFound = 2023,
        [Description("A tour can have at most 3 tags.")]
        TooManyTags = 2024,
        [Description("Tour discount percent/valid-until date are invalid or incomplete.")]
        InvalidTourDiscount = 2025,
        [Description("Order line not found.")]
        OrderLineNotFound = 2026,
        [Description("Selected user is not an employee.")]
        UserIsNotEmployee = 2027,
        [Description("Order must have at least one line.")]
        OrderMustHaveAtLeastOneLine = 2028,
        [Description("Employee role is required to assign an employee.")]
        EmployeeRoleRequired = 2029,
        [Description("Email template is invalid (empty subject/body or unknown action key).")]
        EmailTemplateInvalid = 2030,
        // Чекаут корзины (ADR 025): верхнеуровневый код ответа OrderLinesValidationException —
        // детали лежат в массиве lines (OrderLinesErrorModel), пер-строчные коды прежние
        // (2004/2014/2015/2016).
        [Description("Order has one or more invalid lines.")]
        OrderHasInvalidLines = 2031,
        // Лимит числа строк — именованная константа ATTours.Common.Constants.OrderLimits.MaxOrderLines
        // (зеркало фронтового MAX_CART_ITEMS, spec 008). Здесь литерал только в тексте описания.
        [Description("Order cannot have more than 10 lines.")]
        OrderTooManyLines = 2032,

        // Гибкая система ролей и прав (architecture-flexible-roles.md §3.5). Коды сдвинуты
        // на 2033-2036: 2031/2032 заняты чекаутом корзины (OrderHasInvalidLines/
        // OrderTooManyLines) — коды уходят наружу числом, дублировать нельзя.
        //
        // RoleIsSystem больше нигде не бросается (решение Давида 2026-08-22 — ни одна роль не
        // защищена от переименования/удаления/правки матрицы). Значение оставлено занятым,
        // как и AdminRoleImmutable/AdminAccountImmutable выше по файлу — не переиспользовать
        // под другой смысл, код уходит наружу числом.
        [Description("Role is a system role and cannot be modified or deleted.")]
        RoleIsSystem = 2033,
        [Description("Role has assigned users and cannot be deleted.")]
        RoleInUse = 2034,
        [Description("Unknown admin screen key.")]
        UnknownScreenKey = 2035,
        [Description("Role name is empty or already taken.")]
        RoleNameInvalid = 2036,
        // Уровневая модель прав (ADR 027): уровень должен быть либо None, либо ТОЧНО одним
        // из применимых к экрану действий (нельзя выдать Update у catalog.regions).
        [Description("Permission level is not applicable to this screen.")]
        InvalidPermissionLevel = 2037,

        // Настраиваемые получатели уведомлений (редизайн 2026-08-23).
        [Description("Notification recipient configuration is invalid.")]
        NotificationRecipientInvalid = 2038,

        [Description("Order line employee assignment not found.")]
        OrderLineEmployeeNotFound = 2039,

        // Экран «Фоновые задачи». Состав задач фиксирован BackgroundJobCatalog в коде,
        // поэтому неизвестный ключ — это 404 (такого ресурса нет), а не 400.
        [Description("Unknown background job key.")]
        UnknownJobKey = 2040,
        [Description("Cron expression is not a valid schedule.")]
        InvalidCronExpression = 2041,
        // Ручной запуск при уже идущем прогоне той же задачи. Гонку добивает распределённая
        // блокировка планировщика — этот код только объясняет админу отказ.
        [Description("Background job is already running.")]
        JobAlreadyRunning = 2042,
        // Параметры задачи правятся с её экрана (PATCH api/Jobs/{key}/Parameters) под правом
        // jobs:Update. Ключ настройки, не объявленный в BackgroundJobDefinition.ParameterKeys
        // этой задачи, отвергается: иначе экран задачи стал бы редактором всех настроек
        // сайта в обход права settings:Update. Это 400 (запрос неверный), а не 404 —
        // ресурс-то (задача) существует.
        [Description("Site setting is not a parameter of this background job.")]
        UnknownJobParameter = 2043,

        // Батч «Трансферы + формат продукта» (2026-08-29), ЗАКАЗНАЯ половина — 2044-2049
        // (места группового формата, выбор слота/формата/класса авто, багаж). Все шесть
        // приходят пер-строчно (OrderLinesErrorModel.lines[].errorCode) при чекауте корзины
        // и плоско — при добавлении строки админом и при отправке кастомной заявки.
        //
        // Свободных мест на слоте (тур, дата, время старта) меньше, чем просит строка
        // (решения 0.19/0.20). Занято = Σ GuestCount по строкам всех заказов на этом слоте,
        // кроме Rejected.
        [Description("Not enough seats left for the selected date and start time.")]
        NoSeatsLeft = 2044,
        // Время старта не выбрано или не входит в расписание продукта: клиент выбирает слот
        // ТОЛЬКО из Tour.StartTimes (решение 0.21), свободный ввод не принимается.
        [Description("Selected start time is missing or not offered by this product.")]
        InvalidStartTimeSelection = 2045,
        // Продукт продаётся в обоих форматах (Tour.Format == Both), а строка не сказала,
        // какой выбрал клиент — считать цену не по чему.
        [Description("Format must be specified for a product sold in both formats.")]
        OrderLineFormatRequired = 2046,
        // Бронь предопределённого трансфера без класса авто либо с классом, у которого на
        // этом трансфере нет цены (TransferPrice). Отличается от VehicleClassNotFound (2057,
        // «нет такого класса в справочнике») — здесь класс существует, но не продаётся.
        [Description("Vehicle class is missing or not available for this transfer.")]
        VehicleClassNotAvailable = 2047,
        // Багаж заявки (средний x3 + большой x5, решение 0.13) не влезает в лимит багажа
        // выбранного класса. Проверяется, только если багаж заполнен И класс выбран.
        [Description("Luggage exceeds the luggage capacity of the selected vehicle class.")]
        LuggageExceedsVehicleCapacity = 2048,
        // Пассажиров больше вместимости выбранного класса. У заявки это подсказка «выберите
        // другой класс», у брони предопределённого трансфера — жёсткий отказ.
        [Description("Passenger count exceeds the capacity of the selected vehicle class.")]
        PassengersExceedVehicleCapacity = 2049,

        // Продуктовая половина того же батча — 2050-2057.
        //
        // Формат обязателен у тура/экскурсии и ЗАПРЕЩЁН у трансфера — оба нарушения это
        // «формат не соответствует типу продукта», отдельных кодов не заводим.
        [Description("Tour format is missing or not applicable to this product type.")]
        InvalidTourFormat = 2050,
        // Групповой формат (Group/Both) без цены за человека или без мест на выезд.
        [Description("Group format requires a positive price per person and a positive capacity.")]
        InvalidGroupPricing = 2051,
        // Минимум одно время начала у тура/экскурсии (клиент выбирает из списка, свой ввести
        // не может) и НИ ОДНОГО у трансфера (там время подачи вводит сам клиент).
        [Description("Tour requires at least one start time; a transfer must have none.")]
        InvalidTourStartTimes = 2052,
        // Маршрут трансфера: ровно одна точка «откуда» и ровно одна «куда», стопов сколько угодно.
        [Description("Transfer route must have exactly one 'from' point and exactly one 'to' point.")]
        InvalidTransferRoute = 2053,
        // Цены трансфера по классам авто: минимум один класс, обе цены строго положительные.
        [Description("Transfer requires at least one vehicle class with positive one-way and round-trip prices.")]
        InvalidTransferPrices = 2054,
        // Поля тура, которых у трансфера не бывает (дни, галерея, регионы, теги, скидка,
        // орг.детали/ограничения, доп.расходы) — решение 0.4 чек-листа.
        [Description("Field is not applicable to a transfer product.")]
        TransferFieldNotAllowed = 2055,
        // У трансфера из «богатства» тура остаётся только главная картинка — и она обязательна.
        [Description("Transfer requires a main image.")]
        TransferMainImageRequired = 2056,
        [Description("Vehicle class not found.")]
        VehicleClassNotFound = 2057,

        // Обратный рейс трансфера (решение 0.12): если он заказан, у него обязаны быть своя
        // дата и своё время, и он не может начинаться раньше самой поездки. Зарезервированный
        // диапазон заказной половины (2044-2049) к этому моменту израсходован целиком,
        // поэтому код взят следующим свободным.
        [Description("Return trip requires a date and time not earlier than the outbound trip.")]
        InvalidReturnTrip = 2058,

        // Аудит паритета валидации фронт/бэк (решение 0.29 того же чек-листа): обязательные
        // поля формы, которые до сих пор держал только фронт — русское название продукта,
        // главная картинка, русское название дня многодневного тура, название класса авто.
        // Один код на все: сообщение называет конкретное поле, а разбирать их по отдельным
        // кодам фронту незачем — он и так не даёт отправить такую форму, а этот 400 адресован
        // прямому запросу к API в обход формы.
        [Description("Required field is empty.")]
        RequiredFieldMissing = 2059,

        // Контакты для связи с клиентом (батч 2026-08-29), 2060-2065. Первые три —
        // правила АГРЕГАТА заказа, приходят плоско (не в массиве lines), как
        // OrderMustHaveAtLeastOneLine/OrderTooManyLines.
        [Description("Order must have at least one client contact.")]
        OrderContactRequired = 2060,
        [Description("Order cannot have more than 3 client contacts.")]
        OrderTooManyContacts = 2061,
        // Ни одного основного либо больше одного. Сервер это проверяет, а не досчитывает:
        // кому звонить первым — решение клиента (ADR 032 Р3).
        [Description("Exactly one client contact must be marked as primary.")]
        OrderPrimaryContactInvalid = 2062,
        // Значение не соответствует выбранному способу связи: телефон/WhatsApp/Viber —
        // «+» и 8..15 цифр, Email — адрес, Telegram — @username либо номер.
        // Один код на все способы: сообщение называет конкретный способ, а разбирать их по
        // отдельным кодам фронту незачем — он валидирует то же самое сам.
        [Description("Contact value does not match the selected contact method.")]
        InvalidContactValue = 2063,
        [Description("Contact method not found.")]
        ContactMethodNotFound = 2064,
        [Description("Contact method limit reached for this profile.")]
        TooManyContactMethods = 2065,

        // Исключения из порога автозакрытия (батч 2026-08-29), 2066-2067. Оба приходят с
        // PUT api/Jobs/AutoCloseOverrides — экрана «Автозакрытие дат». Несуществующий
        // продукт своего кода не получает: там переиспользуется TourNotFound (2004), как и
        // в остальных местах, где строка ссылается на продукт.
        //
        // Ноль и отрицательное число отвергаются, а не трактуются как «порог выключен»:
        // выключенное исключение — это отсутствие строки в наборе, и два способа сказать
        // одно и то же на экране означали бы строку, которая ничего не делает.
        [Description("Auto-close lead time override must be a positive number of hours.")]
        InvalidAutoCloseOverride = 2066,
        // Два исключения на один продукт в одном запросе. Серверная проверка обязательна:
        // фронт не даёт добавить дубль, но уникальный индекс упал бы 500-й, а не понятным
        // отказом (и только на самом сохранении).
        [Description("Auto-close lead time override is duplicated for the same product.")]
        DuplicateAutoCloseOverride = 2067,

        // Личные предпочтения пользователя (2026-08-29), 2068-2070. Диапазон начинался с
        // 2066, но 2066-2067 к моменту реализации заняли исключения из порога автозакрытия
        // (соседняя фича того же батча) — дублировать значение enum нельзя, коды уходят
        // наружу числом. Все три отдаются с 400 на PUT api/Account/Preferences. Фронт
        // валидирует ровно то же самое сам, поэтому эти коды адресованы прямому запросу к
        // API в обход формы.
        //
        // Пустой набор каналов. Отдельный код, а не общий «значение неверно»: это
        // единственное из трёх правил, которое фронт обязан объяснить словами — иначе
        // человек снимет обе галочки и перестанет узнавать о собственном заказе.
        [Description("At least one notification channel must be enabled.")]
        NotificationChannelsRequired = 2068,
        // Канал Telegram включён у пользователя без привязанного чата. Молча гасить бит
        // нельзя: человек увидел бы включённую галочку, которая ничего не делает.
        [Description("Telegram notifications require a linked Telegram account.")]
        TelegramChannelNotLinked = 2069,
        // Тема не из {dark, light}, неизвестный пресет палитры (ThemePaletteCatalog),
        // неизвестный код валюты (CurrencyCatalog). Один код на все три: состав допустимых
        // значений фронт и так получает из публичных настроек и каталогов, а сообщение
        // называет конкретное поле — разбирать их по отдельным кодам ему незачем.
        [Description("Preference value is not one of the allowed values.")]
        InvalidPreferenceValue = 2070,

        // Библиотека шаблонов уведомлений (Notification Templates, 2026-08-31), 2071-2073.
        // Открытый CRUD (в отличие от закрытых 4/5 событий «Настроек уведомлений»), поэтому
        // здесь есть NotFound — по чужому/несуществующему Id можно обратиться напрямую.
        [Description("Notification template is invalid (empty required field, bad channel/entity/trigger, or body too large).")]
        NotificationTemplateInvalid = 2071,
        [Description("Notification template not found.")]
        NotificationTemplateNotFound = 2072,
        // Шаблон назначен каналу события ("Настройки уведомлений") или auth-триггеру —
        // удаление тихо снесло бы работающую отправку (та же логика, что у AdminMailbox).
        [Description("Notification template is in use and cannot be deleted.")]
        NotificationTemplateInUse = 2073,

        #endregion

        #region DataErrors
        [Description("Value is not match regex")]
        RegexDoesNotMatch = 2100,
        [Description("Invalid data format")]
        DataFormatMismatch = 2101,
        [Description("Invalid data schema")]
        SchemaValidationError = 2102,
        #endregion

        #region AuthErrors
        [Description("Invalid credentials.")]
        InvalidCredentials = 2200,
        [Description("Account is temporarily locked.")]
        AccountLocked = 2201,
        [Description("Email is not verified.")]
        EmailNotVerified = 2202,
        [Description("Verification token is invalid or expired.")]
        VerificationTokenInvalid = 2203,
        [Description("Password reset token is invalid or expired.")]
        ResetTokenInvalid = 2204,
        [Description("Username is already taken.")]
        UsernameTaken = 2205,
        [Description("Role not found.")]
        RoleNotFound = 2206,
        [Description("Refresh token is invalid or expired.")]
        RefreshTokenInvalid = 2207,
        [Description("Email change code is invalid or expired.")]
        EmailChangeCodeInvalid = 2208,
        [Description("Email change link is invalid or expired.")]
        EmailChangeLinkInvalid = 2209,
        [Description("The old email address has not been confirmed yet, or the confirmation has expired.")]
        EmailChangeNotConfirmed = 2210,
        [Description("This email address is already taken.")]
        EmailAlreadyTaken = 2211,
        [Description("You cannot delete your own account.")]
        CannotDeleteSelf = 2212,
        [Description("Account has been deleted.")]
        AccountDeleted = 2213,
        // 2214/2215 стали недостижимы с D3 (2026-08-09): безусловный запрет на Admin-роль и
        // Admin-аккаунт заменён проверкой прав действующего пользователя (2216). Коды
        // оставлены занятыми, чтобы не переиспользовать их под другой смысл, а тексты
        // приведены к действующему правилу — «в базе руками» больше не единственный путь.
        [Description("Only a super administrator can manage administrator accounts.")]
        AdminRoleImmutable = 2214,
        [Description("Only a super administrator can manage administrator accounts.")]
        AdminAccountImmutable = 2215,
        [Description("Only a super administrator can manage administrator accounts.")]
        SuperAdminPrivilegeRequired = 2216,
        // Impersonation (spec 014 §5). Отсутствие самого права can_impersonate кода не
        // требует — [RequiresImpersonate] отдаёт 403 ещё до сервиса; несуществующая цель
        // переиспользует RelationalEntityNotFound (2003), как и остальной UsersController.
        [Description("You cannot impersonate yourself.")]
        CannotImpersonateSelf = 2217,
        [Description("You are not allowed to impersonate this user.")]
        ImpersonationTargetNotAllowed = 2218,
        // Привязка Telegram (ADR 031 §4): бот не настроен на сервере (нет BotToken или
        // WebhookSecret). Выдавать код в этом состоянии нельзя — пользователь получил бы
        // мёртвую ссылку и ждал бы ответа от несуществующего бота. Отдаётся с 503:
        // это временный пробел конфигурации сервера, а не ошибка запроса.
        [Description("Telegram notifications are not configured on the server.")]
        TelegramNotConfigured = 2219,
        #endregion

        #region UploadErrors
        [Description("Uploaded file exceeds the maximum allowed size.")]
        UploadFileTooLarge = 2300,
        [Description("Uploaded file type is not allowed.")]
        UploadContentTypeNotAllowed = 2301,
        [Description("Uploaded file is not a valid image.")]
        UploadInvalidImage = 2302,
        #endregion

        [Description("Endpoint not existing")]
        EndpointNotExisting = 3000,

        [Description("Internal server error.")]
        InternalServerError = 3001,

        [Description("Unhandled error")]
        UnhandledError = 9999,
    }
}
