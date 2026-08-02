using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.Common.Extensions;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Общая валидация тура для сценариев создания и обновления:
    // Excursion — ровно один день, многодневный Tour — минимум два дня.
    // Базовый класс — context-dependent (не EntityValidationBase<Tour>), потому что
    // проверка существования RegionId требует БД.
    internal class TourValidationService : EntityValidationContextDependentBase<Tour, ATToursContextFactory>
    {
        public TourValidationService(List<Tour> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                ValidateTourDaysByType(entity);
                ValidateDays(entity);
                await ValidateRegionsAsync(entity);
                await ValidatePlaceReferencesAsync(entity);
                await ValidateExpenseTemplateReferencesAsync(entity);
                await ValidateTourNoteTemplateReferencesAsync(entity);
            }
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

        // Регион у тура необязателен (решение Давида D-2). Если регионы всё же переданы:
        // RegionId не должны повторяться, и все они должны существовать в БД.
        private async Task ValidateRegionsAsync(Tour tour)
        {
            if (tour.TourRegions is null || tour.TourRegions.Count == 0)
                return;

            var regionIds = tour.TourRegions.Select(tr => tr.RegionId).ToList();

            var duplicate = regionIds.GroupBy(id => id).FirstOrDefault(group => group.Count() > 1);
            if (duplicate is not null)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    $"Region with id {duplicate.Key} is duplicated in the tour's regions!");

            var existingCount = await Context.Set<Region>().CountAsync(region => regionIds.Contains(region.Id));
            if (existingCount != regionIds.Count)
                throw new ErrorModelException(GlobalErrorCode.RegionNotFound, HttpStatusCode.BadRequest, "One or more regions do not exist.");
        }

        // Каталог Place (3.4): каждая точка с PlaceId != null должна ссылаться на существующую
        // точку каталога. Иначе SQL отдал бы невнятное FK-нарушение вместо 400 PlaceNotFound.
        private async Task ValidatePlaceReferencesAsync(Tour tour)
        {
            if (tour.TourDetails is null)
                return;

            var placeIds = tour.TourDetails
                               .Where(detail => detail.TourDay?.RoutePoints is not null)
                               .SelectMany(detail => detail.TourDay.RoutePoints)
                               .Where(routePoint => routePoint.PlaceId.HasValue)
                               .Select(routePoint => routePoint.PlaceId.GetValueOrDefault())
                               .Distinct()
                               .ToList();

            if (placeIds.Count == 0)
                return;

            var existingCount = await Context.Set<Place>().CountAsync(place => placeIds.Contains(place.Id));
            if (existingCount != placeIds.Count)
                throw new ErrorModelException(GlobalErrorCode.PlaceNotFound, HttpStatusCode.BadRequest, "One or more places do not exist.");
        }

        // Каталог ExpenseTemplate (3.4): каждый расход с ExpenseTemplateId != null должен
        // ссылаться на существующий шаблон.
        private async Task ValidateExpenseTemplateReferencesAsync(Tour tour)
        {
            if (tour.AdditionalExpenses is null)
                return;

            var templateIds = tour.AdditionalExpenses
                                  .Where(expense => expense.ExpenseTemplateId.HasValue)
                                  .Select(expense => expense.ExpenseTemplateId.GetValueOrDefault())
                                  .Distinct()
                                  .ToList();

            if (templateIds.Count == 0)
                return;

            var existingCount = await Context.Set<ExpenseTemplate>().CountAsync(template => templateIds.Contains(template.Id));
            if (existingCount != templateIds.Count)
                throw new ErrorModelException(GlobalErrorCode.ExpenseTemplateNotFound, HttpStatusCode.BadRequest, "One or more expense templates do not exist.");
        }

        // Каталог TourNoteTemplate (3.4): каждая заметка с TourNoteTemplateId != null должна
        // ссылаться на существующий шаблон И совпадать с ним по Type (нельзя привязать
        // орг.деталь к шаблону-ограничению).
        private async Task ValidateTourNoteTemplateReferencesAsync(Tour tour)
        {
            if (tour.Notes is null)
                return;

            var referencingNotes = tour.Notes
                                       .Where(note => note.TourNoteTemplateId.HasValue)
                                       .ToList();

            if (referencingNotes.Count == 0)
                return;

            var templateIds = referencingNotes.Select(note => note.TourNoteTemplateId.GetValueOrDefault()).Distinct().ToList();

            var templateTypeById = await Context.Set<TourNoteTemplate>()
                                                .Where(template => templateIds.Contains(template.Id))
                                                .Select(template => new { template.Id, template.Type })
                                                .ToListAsync();

            var typeById = templateTypeById.ToDictionary(template => template.Id, template => template.Type);

            foreach (var note in referencingNotes)
            {
                var templateId = note.TourNoteTemplateId.GetValueOrDefault();
                if (!typeById.TryGetValue(templateId, out var templateType))
                    throw new ErrorModelException(GlobalErrorCode.TourNoteTemplateNotFound, HttpStatusCode.BadRequest,
                        $"Tour note template with id {templateId} does not exist.");

                if (note.Type != templateType)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                        $"Tour note type {(int)note.Type} does not match template type {(int)templateType}.");
            }
        }
    }
}
