namespace ATTours.Common.DTO.Info
{
    public class AdditionalExpenseInfoModel
    {
        public int Id { get; set; }
        public decimal? Amount { get; set; }
        // Ссылка на каталог ExpenseTemplate (3.4). null = свободная запись без каталога.
        public int? ExpenseTemplateId { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
