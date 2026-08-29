using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Settings;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Jobs
{
    // Ретеншен журнала входов (план, §7.2). LoginHistory пишется на КАЖДЫЙ успешный логин
    // и никем не чистится — без этой задачи таблица растёт линейно и вечно.
    //
    // Удаление батчами через ExecuteDeleteAsync (EF Core 10), а не загрузка сущностей в
    // память: строк может быть сотни тысяч, а удалять нужно именно строки, не граф.
    public class LoginHistoryCleanupJob : TourRepositoryCoreBase<LoginHistory>, IBackgroundJobHandler
    {
        // Размер одного DELETE. Без ограничения удаление годового хвоста за раз держало бы
        // блокировки на таблице и раздувало лог транзакций.
        private const int BatchSize = 1000;

        // Верхняя граница одного прогона. Задача ежедневная: отставание после долгого
        // простоя доберётся следующими прогонами, спешить некуда — тот же приём, что у
        // тримминга истории в BackgroundJobRunner.
        private const int MaxBatchesPerExecution = 50;

        public LoginHistoryCleanupJob() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public async Task<JobRunResult> ExecuteAsync(JobExecutionContext context, CancellationToken cancellationToken)
        {
            int retentionDays;

            await using (var settings = new SiteSettingsInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken))
                retentionDays = await settings.GetNumberAsync(SiteSettingKeys.LoginHistoryRetentionDays);

            // 0 или меньше = «хранить бессрочно». Трактовать это как «удалить всё» значило бы
            // стереть весь журнал входов от одной опечатки в настройке.
            if (retentionDays <= 0)
                return JobRunResult.Skipped($"Очистка выключена: {SiteSettingKeys.LoginHistoryRetentionDays} = {retentionDays}.");

            var threshold = DateTime.UtcNow.AddDays(-retentionDays);
            var deleted = 0;

            for (var batch = 0; batch < MaxBatchesPerExecution; batch++)
            {
                cancellationToken.ThrowIfCancellationRequested();

                // Сначала отбираем Id пачкой, потом удаляем по ним. Прямой Take внутри
                // ExecuteDelete провайдер выразить не обязан, а два дешёвых запроса дают
                // гарантированно предсказуемый SQL и ту же ограниченность батча.
                var expiredIds = await Context.Set<LoginHistory>()
                    .AsNoTracking()
                    .Where(entry => entry.LoggedInAtUtc < threshold)
                    .OrderBy(entry => entry.LoggedInAtUtc)
                    .Select(entry => entry.Id)
                    .Take(BatchSize)
                    .ToListAsync(cancellationToken);

                if (expiredIds.Count == 0)
                    break;

                deleted += await Context.Set<LoginHistory>()
                    .Where(entry => expiredIds.Contains(entry.Id))
                    .ExecuteDeleteAsync(cancellationToken);
            }

            return JobRunResult.Succeeded(deleted,
                $"Удалено записей журнала входов: {deleted} (хранение {retentionDays} дн., до {threshold:dd.MM.yyyy}).");
        }
    }
}
