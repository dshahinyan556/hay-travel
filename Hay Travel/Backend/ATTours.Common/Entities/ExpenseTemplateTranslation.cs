using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Описание расхода. Своего Type нет.
    [EntityTypeConfiguration(typeof(ExpenseTemplateTranslationConfiguration))]
    public class ExpenseTemplateTranslation : EntityBase
    {
        public int ExpenseTemplateId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public ExpenseTemplate ExpenseTemplate { get; set; }
    }
}
