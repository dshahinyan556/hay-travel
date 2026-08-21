using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Availability;
using ATTours.Common.DTO.Info;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Read-model админ-календаря. Сознательно НЕ наследует EntityInfoBase (как и
    // SiteSettingsInfo отходит от паттерна ради слияния источников): результат — не
    // проекция одной сущности, а склейка SQL-агрегата по заказам и резолва правил
    // закрытия в памяти. Ничего не материализуется в БД (ADR 012).
    public class OrderCalendarInfo : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderCalendarInfo(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public OrderCalendarInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task<CalendarMonthModel> GetMonthAsync(int year, int month)
        {
            var firstDay = new DateOnly(year, month, 1);
            var lastDay = new DateOnly(year, month, DateTime.DaysInMonth(year, month));

            var ordersByDay = await LoadOrderAggregatesAsync(firstDay, lastDay);
            var rules = await LoadApplicableRulesAsync(firstDay, lastDay);

            // Глобальные правила отдельно: ими считается IsClosedGlobally, и на них же
            // резолвер отвечает для запроса без тура.
            var globalRules = rules.Where(rule => rule.TourId is null).ToList();
            // Перечисляем только туры, реально фигурирующие в tour-scope правилах месяца,
            // чтобы не итерировать по всем турам БД на каждый день.
            var scopedTourIds = rules.Where(rule => rule.TourId is not null)
                                     .Select(rule => rule.TourId!.Value)
                                     .Distinct()
                                     .OrderBy(tourId => tourId)
                                     .ToList();

            var calendar = new CalendarMonthModel
            {
                Year = year,
                Month = month
            };

            for (var day = firstDay; day <= lastDay; day = day.AddDays(1))
            {
                // Resolve вместо IsClosed: карточке дня, помимо факта закрытия, нужна ещё
                // и причина победившего правила (B12) — IsClosed её выбрасывает.
                var globalWinner = ClosureRuleResolver.Resolve(globalRules, day, tourId: null);
                var isClosedGlobally = globalWinner is { Action: ClosureAction.Close };

                var closedTourIds = isClosedGlobally
                    // Глобально закрытый день закрыт и для всех туров — дублировать их
                    // списком незачем: клиент читает IsClosedGlobally.
                    ? new List<int>()
                    : scopedTourIds.Where(tourId => ClosureRuleResolver.IsClosed(rules, day, tourId)).ToList();

                var ordersOfDay = ordersByDay.TryGetValue(day, out var dayOrders)
                    ? dayOrders
                    : new List<CalendarDayTourOrdersModel>();

                calendar.Days.Add(new CalendarDayModel
                {
                    Date = day,
                    IsClosedGlobally = isClosedGlobally,
                    ClosureReason = isClosedGlobally ? globalWinner!.Reason : null,
                    ClosedTourIds = closedTourIds,
                    TotalOrders = ordersOfDay.Sum(order => order.OrderCount),
                    OrdersByTour = ordersOfDay
                });
            }

            return calendar;
        }

        // Счётчики считает SQL: группировка по (дата, тур) уезжает в БД, наружу приезжают
        // только готовые агрегаты. Занятость теперь читается по СТРОКАМ заказа (ADR 019 — тур
        // и дата переехали на OrderLine). Rejected в занятость не идёт — рабочая гипотеза
        // (не подтверждена Давидом явно, см. OrderStatus.cs и checklist-orders-redesign.txt):
        // всё остальное (включая Hold) считается активной бронью до явного отклонения.
        private async Task<Dictionary<DateOnly, List<CalendarDayTourOrdersModel>>> LoadOrderAggregatesAsync(DateOnly firstDay, DateOnly lastDay)
        {
            var aggregates = await Context.Set<OrderLine>()
                .Where(line => line.Order.Status != OrderStatus.Rejected
                                && line.TourDate >= firstDay
                                && line.TourDate <= lastDay)
                .GroupBy(line => new { line.TourDate, line.TourId })
                .Select(group => new
                {
                    group.Key.TourDate,
                    group.Key.TourId,
                    OrderCount = group.Count(),
                    GuestCount = group.Sum(line => line.GuestCount)
                })
                .ToListAsync(cancellationToken);

            return aggregates
                .GroupBy(aggregate => aggregate.TourDate)
                .ToDictionary(
                    group => group.Key,
                    group => group.OrderBy(aggregate => aggregate.TourId)
                                  .Select(aggregate => new CalendarDayTourOrdersModel
                                  {
                                      TourId = aggregate.TourId,
                                      OrderCount = aggregate.OrderCount,
                                      GuestCount = aggregate.GuestCount
                                  })
                                  .ToList());
        }

        // Правила, способные повлиять на этот месяц: точечные даты внутри месяца и
        // recurring-правила, чей интервал действия месяц пересекает (null-граница = без границы).
        private async Task<List<ClosureRule>> LoadApplicableRulesAsync(DateOnly firstDay, DateOnly lastDay)
        {
            return await Context.Set<ClosureRule>()
                .Where(rule => (rule.Type == ClosureRuleType.Weekly
                                && (rule.EffectiveFrom == null || rule.EffectiveFrom <= lastDay)
                                && (rule.EffectiveTo == null || rule.EffectiveTo >= firstDay))
                               || (rule.Type == ClosureRuleType.SpecificDate
                                   && rule.Date >= firstDay
                                   && rule.Date <= lastDay))
                .ToListAsync(cancellationToken);
        }
    }
}
