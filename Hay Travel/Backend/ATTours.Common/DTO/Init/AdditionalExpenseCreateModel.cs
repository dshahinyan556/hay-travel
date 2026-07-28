using ATTours.Common.DTO.Init;

namespace ATTours.Common.Dto.Init
{
    public class AdditionalExpenseCreateModel
    {
        public decimal? Amount { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
    }
}
