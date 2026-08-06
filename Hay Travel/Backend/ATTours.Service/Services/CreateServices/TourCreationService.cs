using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.BusinessServices.Services;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.CreateServices
{
    public class TourCreationService(Tour entity, CancellationToken cancellationToken = default)
        : CreateVerifiableEntityBase<Tour, ATToursContextFactory>(entity, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
    {
        protected override IEntityValidation GetEntityValidation()
        {
            return new TourValidationService(Entities, Context);
        }

        // Compute-on-write: TotalPrice тура пересчитывается из цен дней при создании.
        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            foreach (var tour in Entities)
                tour.TotalPrice = tour.TourDetails.Sum(td => td.TourDay.Price);

            // B11 (2026-08-06): граф тура целиком новый — у ВСЕХ точек маршрута Id == default,
            // поэтому фото каждой точки с PlaceId копируются в галерею дня, где она стоит.
            // Перед AddRangeAsync (внутри base.ExecuteEntityChangesFactoryAsync), пока граф ещё
            // не персистится.
            await CopyRoutePointImagesIntoGalleriesAsync();

            await base.ExecuteEntityChangesFactoryAsync();
        }

        private async Task CopyRoutePointImagesIntoGalleriesAsync()
        {
            var days = Entities.SelectMany(t => t.TourDetails).Select(td => td.TourDay).ToList();

            var placeIds = days.SelectMany(d => d.RoutePoints)
                                .Where(rp => rp.PlaceId.HasValue)
                                .Select(rp => rp.PlaceId!.Value)
                                .Distinct()
                                .ToList();

            if (placeIds.Count == 0)
                return;

            // У входящего графа RoutePoint.Place не заполнен (это create-DTO) — грузим Place
            // отдельно, одним запросом на весь тур.
            var placesById = await Context.Set<Place>()
                                          .Include(p => p.Images)
                                          .Where(p => placeIds.Contains(p.Id))
                                          .ToDictionaryAsync(p => p.Id, CancellationToken);

            foreach (var day in days)
                RoutePointGalleryImageCopier.AppendImagesForNewRoutePoints(day, day.RoutePoints, placesById);
        }
    }
}
