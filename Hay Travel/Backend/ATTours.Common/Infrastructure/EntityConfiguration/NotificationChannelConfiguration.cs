using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class NotificationChannelConfiguration : IEntityTypeConfiguration<NotificationChannel>
    {
        public void Configure(EntityTypeBuilder<NotificationChannel> builder)
        {
            builder.ToTable(nameof(NotificationChannel));

            // Идентичность строки — пара (событие, платформа): второй строки на ту же пару
            // быть не может, upsert идёт по ней.
            builder.HasIndex(x => new { x.EventKey, x.Platform })
                .IsUnique();
        }
    }
}
