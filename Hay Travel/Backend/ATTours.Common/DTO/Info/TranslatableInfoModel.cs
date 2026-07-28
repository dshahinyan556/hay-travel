using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    public class TranslatableInfoModel
    {
        public int Id { get; set; }
        public int Type { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
    }
}
