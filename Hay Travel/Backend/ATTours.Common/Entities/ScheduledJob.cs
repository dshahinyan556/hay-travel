using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Изменяемое состояние фоновой задачи. Всё неизменяемое (название, хендлер, дефолтный
    // cron) остаётся в BackgroundJobCatalog — в БД лежит ровно то, что админ может
    // переключить, и ничего больше.
    //
    // Строки создаёт ScheduledJobRegistrySync на старте приложения, а не сид миграции:
    // список задач меняется вместе с кодом, и завязывать его на историю миграций значило
    // бы заводить миграцию под каждую новую задачу.
    [EntityTypeConfiguration(typeof(ScheduledJobConfiguration))]
    public class ScheduledJob : EntityBase
    {
        // Ключ из каталога. Идентичность строки — именно он, а не Id.
        public string Key { get; set; }

        // Рубильник задачи. Выключенная задача снимается с расписания и не запускается
        // даже вручную — иначе «выключено» ничего не гарантировало бы.
        public bool IsEnabled { get; set; }

        // Переопределение расписания из админки. null (обычное состояние) = используется
        // BackgroundJobDefinition.DefaultCronExpression. Материализовать дефолт при вставке
        // было бы удобнее для чтения, но тогда правка дефолта в коде не доезжала бы ни до
        // одной уже созданной строки.
        public string CronExpression { get; set; }

        // Аудит правок из админки: кто и когда трогал задачу последним. null — строку
        // никто не менял с момента автосоздания.
        public DateTime? UpdatedAtUtc { get; set; }
    }
}
