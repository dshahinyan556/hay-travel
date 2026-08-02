using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(AdditionalExpenseConfiguration))]
    public class AdditionalExpense : EntityBase
    {
        public int TourId { get; set; }
        public decimal? Amount { get; set; }
        // Ссылка на каталог ExpenseTemplate (3.4). null = свободная запись. Amount всегда
        // per-tour и из каталога не наследуется (D-8) — из шаблона берётся только описание.
        public int? ExpenseTemplateId { get; set; }
        public ExpenseTemplate ExpenseTemplate { get; set; }
        public Tour Tour { get; set; }
        public HashSet<AdditionalExpenseTranslation> Translations { get; set; } = [];
    }
}
