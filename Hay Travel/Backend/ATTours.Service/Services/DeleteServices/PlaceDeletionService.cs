using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.DeleteServices
{
    // Удаление точки каталога (3.4). Restrict в БД защищает целостность, но наружу отдаём
    // внятный код CatalogEntryInUse, а не сырое FK-нарушение из MsSqlContextExceptionHandlerChain.
    public class PlaceDeletionService : RepositoryCoreBase<Place, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public PlaceDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id)
        {
            var place = await EntityRepository.AsQueryable()
                                              .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.PlaceNotFound, HttpStatusCode.NotFound, $"Place with id {id} not found.");

            var inUse = await Context.Set<RoutePoint>().AnyAsync(routePoint => routePoint.PlaceId == id, cancellationToken);
            if (inUse)
                throw new ErrorModelException(GlobalErrorCode.CatalogEntryInUse, HttpStatusCode.BadRequest,
                    $"Place with id {id} is used by one or more route points and cannot be deleted.");

            EntityRepository.Delete(place);
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
