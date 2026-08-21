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
        [Description("At most 6 tours can be featured at once.")]
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
