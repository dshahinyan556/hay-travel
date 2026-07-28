using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class OrganizationalDetailTranslationConfiguration : IEntityTypeConfiguration<OrganizationalDetailTranslation>
    {
        public void Configure(EntityTypeBuilder<OrganizationalDetailTranslation> builder)
        {
            builder.ToTable(nameof(OrganizationalDetailTranslation));

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
