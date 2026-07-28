using System.ComponentModel;

namespace ATTours.Helper.Enums
{
    public enum FieldValidationErrorCode
    {
        [Description("Unexpected fields")]
        UnexpectedFields = 1,
        [Description("Missing required fields")]
        MissingRequiredFields = 2,
        [Description("Request body is required")]
        EmptyRequestBody
    }
}