using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация каталога тегов. Правила: DiscountPercent обязателен и в (0, 100] у Discount-тега,
    // запрещён у Regular; не больше одной строки перевода на язык (как ExpenseTemplate).
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
                ValidateDiscountPercent(entity);
                ValidateTranslations(entity);
            }

            await Task.CompletedTask;
        }

        private static void ValidateDiscountPercent(Tag entity)
        {
            if (entity.Type == TagType.Discount)
            {
                if (entity.DiscountPercent is null || entity.DiscountPercent <= 0 || entity.DiscountPercent > 100)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                        "Discount tag must have a percent value between 0 and 100.");
            }
            else if (entity.DiscountPercent is not null)
            {
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    "Only a discount-type tag can have a percent value.");
            }
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
