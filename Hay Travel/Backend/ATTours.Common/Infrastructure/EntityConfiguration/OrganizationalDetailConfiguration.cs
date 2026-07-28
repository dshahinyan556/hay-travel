using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class OrganizationalDetailConfiguration : IEntityTypeConfiguration<OrganizationalDetail>
    {
        public void Configure(EntityTypeBuilder<OrganizationalDetail> builder)
        {
            builder.ToTable(nameof(OrganizationalDetail));

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.OrganizationalDetail)
                .HasForeignKey(x => x.OrganizationalDetailId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
