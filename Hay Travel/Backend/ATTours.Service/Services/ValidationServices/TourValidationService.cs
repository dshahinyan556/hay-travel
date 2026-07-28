using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.Common.Extensions;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Общая валидация тура для сценариев создания и обновления:
    // Excursion — ровно один день, многодневный Tour — минимум два дня.
    internal class TourValidationService : EntityValidationBase<Tour>
    {
        public TourValidationService(List<Tour> entities) : base(entities)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                ValidateTourDaysByType(entity);
                ValidateDays(entity);
            }
            await Task.CompletedTask;
        }

        private void ValidateTourDaysByType(Tour tour)
        {
            if (tour.TourDetails is null || tour.TourDetails.IsEmpty())
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Tour details mismatch!");
            if (tour.Type == Common.Enums.TourType.Excursion)
            {
                if (tour.TourDetails.Count != 1)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Excursion tour must have exactly one tour day!");
            }
            else if (tour.Type == Common.Enums.TourType.Tour)
            {
                if (tour.TourDetails.Count < 2)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Multi-day tour must have at least two tour days!");
            }
        }

        // Правила уровня дня: цена не может быть отрицательной, и в каждом дне
        // (в т.ч. в единственном дне экскурсии) обязана быть хотя бы одна точка маршрута.
        private void ValidateDays(Tour tour)
        {
            foreach (var detail in tour.TourDetails)
            {
                var day = detail.TourDay;
                if (day is null)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Tour day is missing!");

                if (day.Price < 0)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Tour day price cannot be negative!");

                if (day.RoutePoints is null || day.RoutePoints.IsEmpty())
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Each tour day must have at least one route point!");
            }
        }
    }
}
