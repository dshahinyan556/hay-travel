using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Каталог переиспользуемых описаний доп. расходов (3.4). Слага не имеет — внутренний
    // шаблон, адресуется по Id. Дефолтной суммы не несёт: AdditionalExpense.Amount всегда
    // per-tour (D-8). Из каталога наследуется только описание.
    [EntityTypeConfiguration(typeof(ExpenseTemplateConfiguration))]
    public class ExpenseTemplate : EntityBase
    {
        public int SortOrder { get; set; }
        public HashSet<ExpenseTemplateTranslation> Translations { get; set; } = [];
        // Inverse — для конфигурации FK (Restrict) и проверки «в использовании» при удалении.
        public HashSet<AdditionalExpense> AdditionalExpenses { get; set; } = [];
    }
}
