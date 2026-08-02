using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация каталога точек (3.4). Работает и на создание (Id == 0), и на обновление
    // (Id != 0): проверка уникальности слага исключает саму запись по Id.
    internal class PlaceValidationService : EntityValidationContextDependentBase<Place, ATToursContextFactory>
    {
        public PlaceValidationService(List<Place> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                ValidateTranslations(entity);
                await ValidateRegionAsync(entity);
                await ValidateSlugAsync(entity);
            }
        }

        private static void ValidateTranslations(Place place)
        {
            if (place.Translations is null)
                return;

            var seenLanguages = new HashSet<int>();
            foreach (var translation in place.Translations)
            {
                if (!seenLanguages.Add((int)translation.LanguageCode))
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                        $"Place has duplicated translations for language {(int)translation.LanguageCode}!");
            }
        }

        private async Task ValidateRegionAsync(Place place)
        {
            var regionExists = await Context.Set<Region>().AnyAsync(region => region.Id == place.RegionId);
            if (!regionExists)
                throw new ErrorModelException(GlobalErrorCode.RegionNotFound, HttpStatusCode.BadRequest,
                    $"Region with id {place.RegionId} does not exist.");
        }

        // Слаг уникален. Исключаем запись саму по Id, чтобы обновление без смены слага не падало.
        private async Task ValidateSlugAsync(Place place)
        {
            var slugTaken = await Context.Set<Place>()
                                         .AnyAsync(existing => existing.Slug == place.Slug && existing.Id != place.Id);
            if (slugTaken)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    $"Place slug '{place.Slug}' is already in use.");
        }
    }
}
