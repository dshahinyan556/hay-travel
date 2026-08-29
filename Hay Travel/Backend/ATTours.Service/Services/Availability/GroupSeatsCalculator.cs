using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.Availability
{
    // Свободные места группового формата (решения 0.18-0.20 чек-листа
    // checklist-transfers-format-2026-08-29). Ключ слота — ТРОЙКА (тур, дата, время старта):
    // «мест на выезд» (Tour.GroupCapacity) одно число на весь продукт, но выездов в один
    // день столько, сколько у продукта времён старта.
    //
    // Занято = сумма GuestCount по строкам заказов на этом слоте во ВСЕХ статусах, кроме
    // Rejected — та же гипотеза занятости, что у админского календаря (OrderCalendarInfo):
    // отменённая бронь место не держит, всё остальное (включая Hold и Request) держит.
    //
    // Живёт рядом с ClosureRuleResolver, а не внутри валидации заказа: одно и то же правило
    // читают три вызывающих — валидация чекаута, добавление строки админом и публичный
    // эндпоинт остатка мест (api/Availability/GetGroupSeats).
    public static class GroupSeatsCalculator
    {
        // Занятые места одного слота. excludeOrderId — заказ, чьи собственные строки в
        // занятость не идут: при правке уже сохранённой брони её прежние гости лежат в БД, и
        // без исключения бронь конфликтовала бы сама с собой. Для нового заказа Id == 0 и
        // исключать нечего.
        public static async Task<int> GetBookedSeatsAsync(IApplicationDbContext context, int tourId, DateOnly tourDate,
            TimeOnly startTime, int excludeOrderId, CancellationToken cancellationToken = default)
        {
            return await BookedSeatsQuery(context)
                         .Where(line => line.TourId == tourId
                                        && line.TourDate == tourDate
                                        && line.StartTime == startTime
                                        && line.OrderId != excludeOrderId)
                         .SumAsync(line => line.GuestCount, cancellationToken);
        }

        // Занятость всех слотов тура в диапазоне дат — одним SQL-агрегатом, для публичного
        // read-эндпоинта. Возвращаются только слоты, на которых что-то забронировано:
        // остальные пусты по определению, и гонять их по проводу незачем.
        public static async Task<List<GroupSeatsSlot>> GetBookedSeatsAsync(IApplicationDbContext context, int tourId,
            DateOnly from, DateOnly to, CancellationToken cancellationToken = default)
        {
            if (to < from)
                return [];

            var aggregates = await BookedSeatsQuery(context)
                                   .Where(line => line.TourId == tourId
                                                  && line.TourDate >= from
                                                  && line.TourDate <= to)
                                   .GroupBy(line => new { line.TourDate, line.StartTime })
                                   .Select(group => new
                                   {
                                       group.Key.TourDate,
                                       group.Key.StartTime,
                                       BookedSeats = group.Sum(line => line.GuestCount)
                                   })
                                   .ToListAsync(cancellationToken);

            return [.. aggregates.OrderBy(aggregate => aggregate.TourDate)
                                 .ThenBy(aggregate => aggregate.StartTime)
                                 .Select(aggregate => new GroupSeatsSlot(aggregate.TourDate,
                                     aggregate.StartTime!.Value, aggregate.BookedSeats))];
        }

        // Общая часть обоих запросов: строки с продуктом и выбранным слотом в неотклонённых
        // заказах. StartTime != null отсекает брони, оформленные до появления слотов
        // (миграция 2026-08-29 проставила турам 09:00, но старые СТРОКИ заказов остались без
        // времени) — привязать их к конкретному выезду не к чему.
        private static IQueryable<OrderLine> BookedSeatsQuery(IApplicationDbContext context)
            => context.Set<OrderLine>()
                      .Where(line => line.Order.Status != OrderStatus.Rejected
                                     && line.TourId != null
                                     && line.StartTime != null);

        // Свободные места слота. Отрицательный остаток невозможен: перепродажу отбивает
        // валидация, но если она когда-то будет обойдена вручную, наружу поедет 0, а не «-2».
        public static int ResolveSeatsLeft(int capacity, int bookedSeats)
            => Math.Max(capacity - bookedSeats, 0);
    }

    // Занятость одного слота (дата + время старта) — плоский результат агрегата.
    public record GroupSeatsSlot(DateOnly Date, TimeOnly StartTime, int BookedSeats);
}
