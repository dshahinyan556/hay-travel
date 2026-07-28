using ATTours.Common.Enums;

namespace ATTours.Common.Dto.Abstraction.Interfaces
{
    public interface ITranslatableModel
    {
        public int Type { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
    }
}
