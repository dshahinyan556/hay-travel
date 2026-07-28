using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace ATTours.Helper.Filter
{
    public class FieldErrorModel
    {
        public string FieldPath { get; set; }
        public ModelStateEntry FieldModelState { get; set; }
    }
}
