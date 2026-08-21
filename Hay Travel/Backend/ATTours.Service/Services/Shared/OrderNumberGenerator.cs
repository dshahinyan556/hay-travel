using ATTours.Common.Entities;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.Shared
{
    // "Человеческий" номер заказа: ДДММГГ + 4-значный счётчик, сбрасывается каждый день
    // (Давид, 2026-08-16 — checklist-orders-redesign.txt). Отдельно от Order.Id (техн. PK).
    //
    // Не защищено от гонки двух ОДНОВРЕМЕННЫХ заказов в один день (посчитали бы одинаковый
    // следующий номер) — на текущем объёме брони (ручное подтверждение админом, не поток
    // платежей) собственной очереди на секунду достаточно; уникальный индекс на Order.Number
    // (OrderConfiguration) минимум не даст такому конфликту тихо просочиться в БД. Если
    // трафик вырастет — заменить на SQL SEQUENCE/таблицу-счётчик с блокировкой строки.
    internal static class OrderNumberGenerator
    {
        public static async Task<string> GenerateAsync(IApplicationDbContext context, DateTime createdAtUtc, CancellationToken cancellationToken)
        {
            var prefix = createdAtUtc.ToString("ddMMyy");

            var countToday = await context.Set<Order>()
                .CountAsync(order => order.Number.StartsWith(prefix), cancellationToken);

            return $"{prefix}{(countToday + 1):D4}";
        }
    }
}
