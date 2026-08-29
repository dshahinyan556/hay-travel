using ATTours.Common.DTO.Init;

namespace ATTours.Common.Dto.Init
{
    public class VehicleClassCreateModel
    {
        public int Capacity { get; set; }
        public int LuggageCapacity { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
    }
}
