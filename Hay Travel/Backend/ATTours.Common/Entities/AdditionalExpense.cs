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
        public Tour Tour { get; set; }
        public HashSet<AdditionalExpenseTranslation> Translations { get; set; } = [];
    }
}
