using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class ScheduledJobRunConfiguration : IEntityTypeConfiguration<ScheduledJobRun>
    {
        public void Configure(EntityTypeBuilder<ScheduledJobRun> builder)
        {
            builder.ToTable(nameof(ScheduledJobRun));

            // Та же ширина, что у ScheduledJob.Key — это одно и то же значение.
            builder.Property(x => x.JobKey)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.StartedAtUtc)
                .IsRequired();

            // Обрезается на записи (см. раннер): отчёт задачи — короткая строка для экрана,
            // а не свалка. Ширина как у OrderEvent.Description.
            builder.Property(x => x.Summary)
                .HasMaxLength(1000);

            // Сообщение + тип исключения, без стектрейса: стектрейс идёт в обычные логи
            // приложения, а в БД от него только раздувание таблицы.
            builder.Property(x => x.Error)
                .HasMaxLength(2000);

            builder.Property(x => x.ActorFullName)
                .HasMaxLength(200);

            // Основной сценарий чтения — «последние N прогонов конкретной задачи»
            // (GET api/Jobs/{key}/Runs) и по нему же идёт тримминг ретеншена.
            builder.HasIndex(x => new { x.JobKey, x.StartedAtUtc });
        }
    }
}
