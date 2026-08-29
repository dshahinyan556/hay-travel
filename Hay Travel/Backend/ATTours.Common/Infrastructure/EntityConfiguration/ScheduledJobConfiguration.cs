using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class ScheduledJobConfiguration : IEntityTypeConfiguration<ScheduledJob>
    {
        public void Configure(EntityTypeBuilder<ScheduledJob> builder)
        {
            builder.ToTable(nameof(ScheduledJob));

            builder.Property(x => x.Key)
                .IsRequired()
                .HasMaxLength(100);

            // Стандартный cron с секундами укладывается в 100 символов с большим запасом.
            builder.Property(x => x.CronExpression)
                .HasMaxLength(100);

            // Идентичность строки — ключ задачи. Unique-индекс здесь не «на всякий случай»:
            // на нём держится апсерт реестра, а два старта приложения могут выполниться
            // одновременно (rolling-деплой) и создать дубль.
            builder.HasIndex(x => x.Key)
                .IsUnique();
        }
    }
}
