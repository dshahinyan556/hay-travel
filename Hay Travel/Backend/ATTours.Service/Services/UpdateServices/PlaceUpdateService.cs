using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Обновление точки каталога (3.4): скалярные поля + сверка переводов по Id (add/update/remove).
    public class PlaceUpdateService : EntityActionServiceBase<Place, ATToursContextFactory>
    {
        public PlaceUpdateService(Place entity, CancellationToken cancellationToken = default)
            : base(entity, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
        }

        public PlaceUpdateService(Place entity, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entity, context, cancellationToken)
        {
        }

        public async Task UpdateAsync() => await ExecuteEntityChangesAsync();

        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            var incoming = Entities.Single();

            await new PlaceValidationService([incoming], Context).ValidateEntitiesAsync();

            var existing = await EntityRepository.AsQueryable()
                                                 .Include(x => x.Translations)
                                                 .SingleOrDefaultAsync(x => x.Id == incoming.Id, CancellationToken)
                           ?? throw new ErrorModelException(GlobalErrorCode.PlaceNotFound, HttpStatusCode.NotFound, $"Place with id {incoming.Id} not found.");

            existing.Slug = incoming.Slug;
            existing.RegionId = incoming.RegionId;
            existing.Latitude = incoming.Latitude;
            existing.Longitude = incoming.Longitude;
            existing.ImageUrl = incoming.ImageUrl;
            existing.SortOrder = incoming.SortOrder;

            ReconcileTranslations(existing.Translations, incoming.Translations);
        }

        // Сверка переводов по Id: Id == 0 -> add, совпадающий Id -> update, отсутствующий во
        // входящих -> remove. Отдельный метод у каждого среза (не общая каталог-база) — так
        // проект держит явные per-entity слайсы (3.4.11).
        private static void ReconcileTranslations(ICollection<PlaceTranslation> existing, ICollection<PlaceTranslation> incoming)
        {
            var incomingItems = incoming ?? [];
            var existingById = existing.Where(t => t.Id != default).ToDictionary(t => t.Id);
            var touchedIds = new HashSet<int>();

            foreach (var incomingItem in incomingItems)
            {
                if (incomingItem.Id == default)
                {
                    existing.Add(incomingItem);
                    continue;
                }

                if (existingById.TryGetValue(incomingItem.Id, out var target))
                {
                    target.LanguageCode = incomingItem.LanguageCode;
                    target.Value = incomingItem.Value;
                    touchedIds.Add(incomingItem.Id);
                }
            }

            foreach (var stale in existing.Where(t => t.Id != default && !touchedIds.Contains(t.Id)).ToList())
                existing.Remove(stale);
        }
    }
}
