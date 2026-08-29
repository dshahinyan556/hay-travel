using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Обновление класса авто: Capacity/LuggageCapacity/SortOrder/IsActive + сверка переводов
    // по Id (по образцу TagUpdateService).
    public class VehicleClassUpdateService : EntityActionServiceBase<VehicleClass, ATToursContextFactory>
    {
        public VehicleClassUpdateService(VehicleClass entity, CancellationToken cancellationToken = default)
            : base(entity, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
        }

        public VehicleClassUpdateService(VehicleClass entity, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entity, context, cancellationToken)
        {
        }

        public async Task UpdateAsync() => await ExecuteEntityChangesAsync();

        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            var incoming = Entities.Single();

            await new VehicleClassValidationService([incoming], Context).ValidateEntitiesAsync();

            var existing = await EntityRepository.AsQueryable()
                                                 .Include(x => x.Translations)
                                                 .SingleOrDefaultAsync(x => x.Id == incoming.Id, CancellationToken)
                           ?? throw new ErrorModelException(GlobalErrorCode.VehicleClassNotFound, HttpStatusCode.NotFound,
                               $"Vehicle class with id {incoming.Id} not found.");

            // Вместимость и лимит багажа правятся свободно, даже у класса, который уже
            // продаётся: название класса в оформленной броне живёт снапшотом на строке заказа
            // (OrderLine.VehicleClassNameSnapshot), а цена — на TransferPrice конкретного
            // трансфера, поэтому задним числом ничего не едет.
            existing.Capacity = incoming.Capacity;
            existing.LuggageCapacity = incoming.LuggageCapacity;
            existing.SortOrder = incoming.SortOrder;
            existing.IsActive = incoming.IsActive;

            ReconcileTranslations(existing.Translations, incoming.Translations);
        }

        // Сверка переводов по Id — отдельный метод у каждого среза (см. TagUpdateService).
        private static void ReconcileTranslations(ICollection<VehicleClassTranslation> existing,
            ICollection<VehicleClassTranslation> incoming)
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
