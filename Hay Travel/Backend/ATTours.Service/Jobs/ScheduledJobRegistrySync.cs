using ATTours.Common.Entities;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Jobs
{
    // Приводит таблицу ScheduledJob в соответствие с BackgroundJobCatalog при старте
    // приложения. Сида в миграции нет намеренно: состав задач меняется вместе с кодом,
    // и заводить миграцию под каждую новую задачу — ровно та жёсткость, от которой
    // каталог в коде и избавляет (ADR 002, тот же приём, что у SiteSettings).
    public class ScheduledJobRegistrySync : TourRepositoryCoreBase<ScheduledJob>
    {
        public ScheduledJobRegistrySync() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public ScheduledJobRegistrySync(string connectionString) : base(connectionString) { }

        public ScheduledJobRegistrySync(IApplicationDbContext context) : base(context) { }

        // Возвращает число созданных строк. Идемпотентно: второй запуск не меняет ничего.
        public async Task<int> SyncAsync(CancellationToken cancellationToken = default)
        {
            var existingKeys = (await EntityRepository.AsQueryable()
                                                      .AsNoTracking()
                                                      .Select(job => job.Key)
                                                      .ToListAsync(cancellationToken))
                               .ToHashSet(StringComparer.Ordinal);

            var created = new List<ScheduledJob>();
            foreach (var definition in BackgroundJobCatalog.All)
            {
                if (existingKeys.Contains(definition.Key))
                    continue;

                created.Add(new ScheduledJob
                {
                    Key = definition.Key,
                    IsEnabled = definition.EnabledByDefault,

                    // Пусто = «как в каталоге». Материализовать дефолтный cron здесь было бы
                    // удобнее для чтения, но тогда правка расписания в коде не доехала бы ни
                    // до одной уже созданной строки.
                    CronExpression = null
                });
            }

            // Существующие строки НЕ трогаются: IsEnabled и CronExpression принадлежат
            // админу, и рестарт приложения не имеет права возвращать их к дефолтам.
            //
            // Строки задач, которых больше нет в каталоге, тоже не удаляются: они ничего не
            // запускают (раннер сверяется с каталогом), но остаются вместе со своей историей
            // прогонов — на случай возврата задачи и на случай разбора «а что тут работало».
            if (created.Count == 0)
                return 0;

            await EntityRepository.AddRangeAsync(created, cancellationToken);

            try
            {
                return await EntityRepository.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Гонка двух стартующих инстансов на unique-индексе ScheduledJob.Key:
                // строку успел создать сосед, результат ровно тот, что нужен. Ронять старт
                // API из-за выигранной кем-то гонки нельзя.
                return 0;
            }
        }
    }
}
