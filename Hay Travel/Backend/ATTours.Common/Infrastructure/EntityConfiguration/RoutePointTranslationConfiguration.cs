using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class RoutePointTranslationConfiguration : IEntityTypeConfiguration<RoutePointTranslation>
    {
        public void Configure(EntityTypeBuilder<RoutePointTranslation> builder)
        {
            builder.ToTable(nameof(RoutePointTranslation));

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(4000);
        }
    }
}
