using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TagTranslationConfiguration : IEntityTypeConfiguration<TagTranslation>
    {
        public void Configure(EntityTypeBuilder<TagTranslation> builder)
        {
            builder.ToTable(nameof(TagTranslation));

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(100);
        }
    }
}
