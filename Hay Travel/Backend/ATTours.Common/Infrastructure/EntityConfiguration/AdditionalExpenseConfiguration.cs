using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class AdditionalExpenseConfiguration : IEntityTypeConfiguration<AdditionalExpense>
    {
        public void Configure(EntityTypeBuilder<AdditionalExpense> builder)
        {
            builder.ToTable(nameof(AdditionalExpense));

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.AdditionalExpense)
                .HasForeignKey(x => x.AdditionalExpenseId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(x => x.Amount)
                .HasPrecision(18, 2);

            // Ссылка на каталог (3.4). Restrict — см. RoutePointConfiguration.
            builder.HasOne(x => x.ExpenseTemplate)
                .WithMany(x => x.AdditionalExpenses)
                .HasForeignKey(x => x.ExpenseTemplateId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
