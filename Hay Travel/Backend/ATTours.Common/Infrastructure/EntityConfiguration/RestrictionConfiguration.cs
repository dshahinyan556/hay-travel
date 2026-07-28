using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class RestrictionConfiguration : IEntityTypeConfiguration<Restriction>
    {
        public void Configure(EntityTypeBuilder<Restriction> builder)
        {
            builder.ToTable(nameof(Restriction));

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.Restriction)
                .HasForeignKey(x => x.RestrictionId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
