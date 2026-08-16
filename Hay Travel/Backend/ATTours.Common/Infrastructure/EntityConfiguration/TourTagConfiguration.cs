using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    // Join-сущность с двумя родителями — оба FK конфигурируются здесь (не в TourConfiguration),
    // как TourRegionConfiguration.
    public class TourTagConfiguration : IEntityTypeConfiguration<TourTag>
    {
        public void Configure(EntityTypeBuilder<TourTag> builder)
        {
            builder.ToTable(nameof(TourTag));

            builder.HasOne(x => x.Tour)
                .WithMany(x => x.TourTags)
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            // Тег нельзя удалить, пока он назначен хотя бы одному туру (TagDeletionService).
            builder.HasOne(x => x.Tag)
                .WithMany(x => x.TourTags)
                .HasForeignKey(x => x.TagId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(x => new { x.TourId, x.TagId })
                .IsUnique();
        }
    }
}
