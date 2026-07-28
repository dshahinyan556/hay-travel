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

        #endregion

        #region DataErrors
        [Description("Value is not match regex")]
        RegexDoesNotMatch = 2100,
        [Description("Invalid data format")]
        DataFormatMismatch = 2101,
        [Description("Invalid data schema")]
        SchemaValidationError = 2102,
        #endregion

        [Description("Endpoint not existing")]
        EndpointNotExisting = 3000,

        [Description("Internal server error.")]
        InternalServerError = 3001,

        [Description("Unhandled error")]
        UnhandledError = 9999,
    }
}
