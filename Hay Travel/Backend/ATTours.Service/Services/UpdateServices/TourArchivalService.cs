using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Мягкое удаление / восстановление тура (IsArchived).
    // По образцу TourActivationService: грузит одну строку без include-графа и обновляет только флаг.
    public class TourArchivalService : RepositoryCoreBase<Tour, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public TourArchivalService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task SetArchivedAsync(int id, bool isArchived)
        {
            var tour = await EntityRepository.AsQueryable()
                                             .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.NotFound, $"Tour with id {id} not found.");

            tour.IsArchived = isArchived;
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
