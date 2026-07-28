using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Точечное переключение публикации тура (IsActive).
    // Грузит единственную строку без include-графа и обновляет только флаг.
    public class TourActivationService : RepositoryCoreBase<Tour, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public TourActivationService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task SetActiveAsync(int id, bool isActive)
        {
            var tour = await EntityRepository.AsQueryable()
                                             .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.NotFound, $"Tour with id {id} not found.");

            tour.IsActive = isActive;
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
