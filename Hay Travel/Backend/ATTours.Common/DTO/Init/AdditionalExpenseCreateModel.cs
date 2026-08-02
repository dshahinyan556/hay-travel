using ATTours.Common.DTO.Init;

namespace ATTours.Common.Dto.Init
{
    public class AdditionalExpenseCreateModel
    {
        public decimal? Amount { get; set; }
        // Ссылка на каталог ExpenseTemplate (3.4). null = свободная запись без каталога.
        public int? ExpenseTemplateId { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
    }
}
