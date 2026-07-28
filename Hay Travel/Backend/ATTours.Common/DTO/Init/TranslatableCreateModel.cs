using ATTours.Common.Dto.Abstraction.Interfaces;
using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Init
{
    public class TranslatableCreateModel : ITranslatableModel
    {
        public int Type { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
    }
}
