using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.DeleteServices
{
    // Полное удаление тура вместе со всем графом.
    // Тур каскадит переводы/доп.расходы/орг.детали/ограничения и join-строки TourDetail,
    // а TourDay удаляются явно (их GalleryImages/RoutePoints/переводы уходят каскадом).
    public class TourDeletionService : RepositoryCoreBase<Tour, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public TourDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id)
        {
            var tour = await EntityRepository.AsQueryable()
                                             .Include(x => x.TourDetails)
                                             .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.NotFound, $"Tour with id {id} not found.");

            // OrderLine.TourId — Restrict (строка заказа нельзя осиротить, ADR 019), поэтому
            // без этой проверки удаление тура с бронями упало бы сырым FK-нарушением через
            // MsSqlContextExceptionHandlerChain вместо внятного кода — тот же приём, что
            // CatalogEntryInUse у каталогов. Правила закрытия (ClosureRule) уходят каскадом
            // и удалению не мешают.
            var hasOrders = await Context.Set<OrderLine>().AnyAsync(line => line.TourId == id, cancellationToken);
            if (hasOrders)
                throw new ErrorModelException(GlobalErrorCode.TourHasOrders, HttpStatusCode.BadRequest,
                    $"Tour with id {id} has orders and cannot be deleted.");

            var tourDays = tour.TourDetails
                               .Select(td => td.TourDay)
                               .Where(day => day is not null)
                               .ToList();

            // Удаляем дни отдельно — они не привязаны к туру FK-каскадом (связь через join TourDetail).
            var tourDayRepository = new EntityRepository<TourDay>(Context);
            if (tourDays.Count > 0)
                tourDayRepository.DeleteRange(tourDays);

            EntityRepository.Delete(tour);

            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
