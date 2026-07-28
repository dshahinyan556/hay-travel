using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class RestrictionTranslationConfiguration : IEntityTypeConfiguration<RestrictionTranslation>
    {
        public void Configure(EntityTypeBuilder<RestrictionTranslation> builder)
        {
            builder.ToTable(nameof(RestrictionTranslation));

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
