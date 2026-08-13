using ATTours.BusinessServices.Core.Info;
using ATTours.BusinessServices.Services.Availability;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение правил закрытия. Граф пустой: Tour в правило не включается (ClosureRuleInfoModel
    // несёт только TourId), переводов у правила нет.
    public class ClosureRuleInfo : EntityInfoBase<ClosureRule>
    {
        public ClosureRuleInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public ClosureRuleInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public ClosureRuleInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        // Публичный booking-card: плоский список закрытых дат тура в диапазоне.
        // Материализация происходит В ОТВЕТЕ, а не в БД (ADR 012) — в БД лежат правила.
        // Диапазон ограничен окном бронирования (~3 месяца), поэтому проход по дням дёшев.
        public async Task<List<DateOnly>> GetClosedDatesAsync(int tourId, DateOnly from, DateOnly to)
        {
            var closedDates = new List<DateOnly>();
            if (to < from)
                return closedDates;

            // Применимые правила = глобальные + правила этого тура. Отбор конкретных дней
            // делает резолвер: precedence нельзя выразить SQL-фильтром.
            var rules = await GetAllAsync(rule => rule.TourId == null || rule.TourId == tourId);

            for (var day = from; day <= to; day = day.AddDays(1))
            {
                if (ClosureRuleResolver.IsClosed(rules, day, tourId))
                    closedDates.Add(day);

                // Защита от переполнения на верхней границе DateOnly: AddDays бросил бы
                // ArgumentOutOfRange вместо того, чтобы закончить цикл.
                if (day == DateOnly.MaxValue)
                    break;
            }

            return closedDates;
        }
    }
}
