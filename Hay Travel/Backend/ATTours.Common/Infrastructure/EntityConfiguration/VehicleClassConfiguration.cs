using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class VehicleClassConfiguration : IEntityTypeConfiguration<VehicleClass>
    {
        public void Configure(EntityTypeBuilder<VehicleClass> builder)
        {
            builder.ToTable(nameof(VehicleClass));

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.VehicleClass)
                .HasForeignKey(x => x.VehicleClassId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
