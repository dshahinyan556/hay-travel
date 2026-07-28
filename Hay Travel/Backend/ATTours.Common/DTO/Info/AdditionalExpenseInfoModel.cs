namespace ATTours.Common.DTO.Info
{
    public class AdditionalExpenseInfoModel
    {
        public int Id { get; set; }
        public decimal? Amount { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
