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
        #endregion

        [Description("Endpoint not existing")]
        EndpointNotExisting = 3000,

        [Description("Internal server error.")]
        InternalServerError = 3001,

        [Description("Unhandled error")]
        UnhandledError = 9999,
    }
}
