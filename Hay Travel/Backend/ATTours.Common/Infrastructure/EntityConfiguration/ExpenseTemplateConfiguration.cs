using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class ExpenseTemplateConfiguration : IEntityTypeConfiguration<ExpenseTemplate>
    {
        public void Configure(EntityTypeBuilder<ExpenseTemplate> builder)
        {
            builder.ToTable(nameof(ExpenseTemplate));

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.ExpenseTemplate)
                .HasForeignKey(x => x.ExpenseTemplateId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
