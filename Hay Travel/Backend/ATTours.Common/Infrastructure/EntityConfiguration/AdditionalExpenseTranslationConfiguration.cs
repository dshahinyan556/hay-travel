using ATTours.Common.Entities;
using ATTours.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class AdditionalExpenseTranslationConfiguration : IEntityTypeConfiguration<AdditionalExpenseTranslation>
    {
        public void Configure(EntityTypeBuilder<AdditionalExpenseTranslation> builder)
        {
            builder.ToTable(nameof(AdditionalExpenseTranslation));

            builder.Property(x => x.Value)
                .HasMaxLength(4000);

        }
    }
}
