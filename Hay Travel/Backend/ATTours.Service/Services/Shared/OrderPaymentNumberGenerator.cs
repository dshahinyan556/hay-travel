using ATTours.Common.Entities;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.Shared
{
    // Автономер проводки: "PP" + 10-значный сквозной счётчик (мокап: PP0000000001), НЕ
    // сбрасывается по дням — в отличие от OrderNumberGenerator. Та же оговорка про гонку
    // двух одновременных проводок и тот же план на будущее (SQL SEQUENCE), см. там же.
    internal static class OrderPaymentNumberGenerator
    {
        private const string Prefix = "PP";

        public static async Task<string> GenerateAsync(IApplicationDbContext context, CancellationToken cancellationToken)
        {
            var count = await context.Set<OrderPayment>().CountAsync(cancellationToken);
            return $"{Prefix}{(count + 1):D10}";
        }
    }
}
