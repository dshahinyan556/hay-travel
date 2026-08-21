using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация каталога тегов. Правило: не больше одной строки перевода на язык
    // (как ExpenseTemplate). Скидка больше не часть тега (Фаза 3) — см. TourValidationService.
    internal class TagValidationService : EntityValidationContextDependentBase<Tag, ATToursContextFactory>
    {
        public TagValidationService(List<Tag> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                ValidateTranslations(entity);
            }

            await Task.CompletedTask;
        }

        private static void ValidateTranslations(Tag entity)
        {
            if (entity.Translations is null)
                return;

            var seenLanguages = new HashSet<int>();
            foreach (var translation in entity.Translations)
            {
                if (!seenLanguages.Add((int)translation.LanguageCode))
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                        $"Tag has duplicated translations for language {(int)translation.LanguageCode}!");
            }
        }
    }
}
