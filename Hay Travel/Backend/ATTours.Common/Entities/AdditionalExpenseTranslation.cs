using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(AdditionalExpenseTranslationConfiguration))]
    public class AdditionalExpenseTranslation : EntityBase
    {
        public int AdditionalExpenseId { get; set; }
        public ExpenseTranslationType Type { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public AdditionalExpense AdditionalExpense { get; set; }
    }
}
