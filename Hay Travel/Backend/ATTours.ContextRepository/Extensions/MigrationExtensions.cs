using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ATTours.ContextRepository.Extensions
{
    public static class MigrationExtensions
    {
        // Azure SQL Serverless засыпает при простое: первое подключение после паузы валится
        // транзиентной ошибкой (SQL 40613 "database ... is not currently available"), пока база
        // просыпается (обычно 30-60с). Без ретрая это роняло старт всего приложения (HTTP 500.30,
        // не самовосстанавливается) при каждом холодном старте после простоя — см. прод-инцидент
        // 2026-08-10. Суммарный бюджет ожидания ~125с с запасом покрывает типичное время побудки.
        private static readonly TimeSpan[] RetryDelays =
        {
            TimeSpan.FromSeconds(5),
            TimeSpan.FromSeconds(10),
            TimeSpan.FromSeconds(20),
            TimeSpan.FromSeconds(30),
            TimeSpan.FromSeconds(60),
        };

        public static IServiceProvider MigrateDatabase<TContext>(this IServiceProvider serviceProvider)
            where TContext : DbContext, IApplicationDbContext
        {
            using (var scope = serviceProvider.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<TContext>();
                var logger = scope.ServiceProvider.GetService<ILoggerFactory>()?
                    .CreateLogger("ATTours.Startup.Migrations");

                for (var attempt = 0; ; attempt++)
                {
                    try
                    {
                        dbContext.Database.Migrate();
                        break;
                    }
                    catch (Exception ex) when (attempt < RetryDelays.Length)
                    {
                        var delay = RetryDelays[attempt];
                        logger?.LogWarning(ex,
                            "Миграция БД не удалась (попытка {Attempt}/{Max}), похоже на холодный старт Azure SQL — повтор через {DelaySeconds}с",
                            attempt + 1, RetryDelays.Length, delay.TotalSeconds);
                        Thread.Sleep(delay);
                    }
                }
            }
            return serviceProvider;
        }
    }
}
