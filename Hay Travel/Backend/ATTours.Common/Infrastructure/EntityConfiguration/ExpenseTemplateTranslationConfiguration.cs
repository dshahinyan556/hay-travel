using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class ExpenseTemplateTranslationConfiguration : IEntityTypeConfiguration<ExpenseTemplateTranslation>
    {
        public void Configure(EntityTypeBuilder<ExpenseTemplateTranslation> builder)
        {
            builder.ToTable(nameof(ExpenseTemplateTranslation));

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
