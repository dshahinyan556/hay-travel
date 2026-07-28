using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Settings;

namespace ATTours.BusinessServices.Services.CreateServices
{
    public class TourCreationService(Tour entity, CancellationToken cancellationToken = default)
        : CreateVerifiableEntityBase<Tour, ATToursContextFactory>(entity, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
    {
        protected override IEntityValidation GetEntityValidation()
        {
            return new TourValidationService(Entities);
        }

        // Compute-on-write: TotalPrice тура пересчитывается из цен дней при создании.
        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            foreach (var tour in Entities)
                tour.TotalPrice = tour.TourDetails.Sum(td => td.TourDay.Price);

            await base.ExecuteEntityChangesFactoryAsync();
        }
    }
}
