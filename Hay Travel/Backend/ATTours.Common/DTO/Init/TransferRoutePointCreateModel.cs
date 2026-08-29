using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

namespace ATTours.Common.Dto.Init
{
    public class TransferRoutePointCreateModel
    {
        public TransferRoutePointKind Kind { get; set; }
        public int SortOrder { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
    }
}
