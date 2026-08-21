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
    // Обновление тега: Type/Color/SortOrder + сверка переводов по Id.
    public class TagUpdateService : EntityActionServiceBase<Tag, ATToursContextFactory>
    {
        public TagUpdateService(Tag entity, CancellationToken cancellationToken = default)
            : base(entity, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
        }

        public TagUpdateService(Tag entity, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entity, context, cancellationToken)
        {
        }

        public async Task UpdateAsync() => await ExecuteEntityChangesAsync();

        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            var incoming = Entities.Single();

            await new TagValidationService([incoming], Context).ValidateEntitiesAsync();

            var existing = await EntityRepository.AsQueryable()
                                                 .Include(x => x.Translations)
                                                 .Include(x => x.TourTags)
                                                 .SingleOrDefaultAsync(x => x.Id == incoming.Id, CancellationToken)
                           ?? throw new ErrorModelException(GlobalErrorCode.TagNotFound, HttpStatusCode.NotFound, $"Tag with id {incoming.Id} not found.");

            // Тип тега неизменяем, пока тег назначен хотя бы одному туру (тот же принцип, что
            // у Tour.Type в TourUpdateService) — задел под будущие виды тегов, сейчас
            // TagType содержит только Regular.
            if (existing.TourTags.Count > 0 && existing.Type != incoming.Type)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    "Tag type cannot be changed while the tag is assigned to a tour.");

            existing.Type = incoming.Type;
            existing.Color = incoming.Color;
            existing.SortOrder = incoming.SortOrder;

            ReconcileTranslations(existing.Translations, incoming.Translations);
        }

        // Сверка переводов по Id (см. ExpenseTemplateUpdateService) — отдельный метод у каждого среза.
        private static void ReconcileTranslations(ICollection<TagTranslation> existing, ICollection<TagTranslation> incoming)
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
