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
    // Read-модель остатка мест группового формата (батч «Трансферы + формат», 2026-08-29).
    // Как и OrderCalendarInfo, сознательно НЕ наследует EntityInfoBase: результат — склейка
    // ёмкости продукта и SQL-агрегата по строкам заказов, а не проекция одной сущности.
    //
    // Ничего не материализуется в БД: «мест осталось» — производная величина, ровно как
    // «день закрыт» (ADR 012).
    public class GroupSeatsInfo : RepositoryCoreBase<Tour, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public GroupSeatsInfo(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public GroupSeatsInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context)
        {
            this.cancellationToken = cancellationToken;
        }

        // Несуществующий/неопубликованный продукт отдаёт пустую модель, а не 404: этим
        // эндпоинтом блок брони гасит слоты, и отличать «нет мест» от «нет продукта» ему
        // незачем — деталь продукта он всё равно читает отдельным запросом.
        public async Task<TourGroupSeatsModel> GetAsync(int tourId, DateOnly from, DateOnly to)
        {
            var tour = await Context.Set<Tour>()
                                    .AsNoTracking()
                                    .Where(x => x.Id == tourId && x.IsActive && !x.IsArchived)
                                    .Select(x => new { x.Format, x.GroupCapacity })
                                    .FirstOrDefaultAsync(cancellationToken);

            var seats = new TourGroupSeatsModel
            {
                TourId = tourId,
                Format = tour?.Format,
                Capacity = tour?.GroupCapacity ?? 0
            };

            // У индивидуального формата ограничителя нет вовсе — считать и отдавать
            // занятость по слотам значило бы намекнуть фронту на несуществующий лимит.
            if (tour?.Format is not (TourFormat.Group or TourFormat.Both) || seats.Capacity <= 0)
                return seats;

            var booked = await GroupSeatsCalculator.GetBookedSeatsAsync(Context, tourId, from, to, cancellationToken);

            seats.Slots = [.. booked.Select(slot => new TourGroupSeatsSlotModel
            {
                Date = slot.Date,
                StartTime = slot.StartTime,
                BookedSeats = slot.BookedSeats,
                SeatsLeft = GroupSeatsCalculator.ResolveSeatsLeft(seats.Capacity, slot.BookedSeats)
            })];

            return seats;
        }
    }
}
