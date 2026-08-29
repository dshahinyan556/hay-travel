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
    // Валидация справочника классов авто (батч 2026-08-29). Правило переводов то же, что у
    // Tag (не больше одной строки на язык), плюс числовые ограничения самого класса:
    // вместимость и лимит багажа участвуют в бизнес-решениях (перевод формы в кастомную
    // заявку при переборе пассажиров, проверка багажа), поэтому нулевой класс сломал бы их
    // молча.
    internal class VehicleClassValidationService : EntityValidationContextDependentBase<VehicleClass, ATToursContextFactory>
    {
        public VehicleClassValidationService(List<VehicleClass> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                ValidateTranslations(entity);
                ValidateNames(entity);
                ValidateCapacities(entity);
            }

            await Task.CompletedTask;
        }

        private static void ValidateTranslations(VehicleClass entity)
        {
            if (entity.Translations is null)
                return;

            var seenLanguages = new HashSet<int>();
            foreach (var translation in entity.Translations)
            {
                if (!seenLanguages.Add((int)translation.LanguageCode))
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                        $"Vehicle class has duplicated translations for language {(int)translation.LanguageCode}!");
            }
        }

        // Название обязательно на ОБОИХ языках — так же, как этого требует форма справочника
        // (VehicleClassForm.validate: nameRu + nameEn), решение 0.29. В отличие от продукта,
        // где EN необязателен, класс авто виден клиенту в блоке брони на обоих языках:
        // безымянный класс превратился бы в пустую строку выпадающего списка.
        private static void ValidateNames(VehicleClass entity)
        {
            foreach (var languageCode in new[] { LanguageCode.Russian, LanguageCode.English })
            {
                var hasName = entity.Translations is not null
                              && entity.Translations.Any(translation => translation.LanguageCode == languageCode
                                                                        && !string.IsNullOrWhiteSpace(translation.Value));
                if (!hasName)
                    throw new ErrorModelException(GlobalErrorCode.RequiredFieldMissing, HttpStatusCode.BadRequest,
                        $"Vehicle class name is required for language {(int)languageCode}.");
            }
        }

        // Лимит багажа может быть нулевым (класс без багажника — осмысленный случай),
        // вместимость — нет: класс, в который нельзя посадить ни одного пассажира, не
        // выбирается ни в одной форме.
        private static void ValidateCapacities(VehicleClass entity)
        {
            if (entity.Capacity <= 0)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    "Vehicle class capacity must be greater than zero.");

            if (entity.LuggageCapacity < 0)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    "Vehicle class luggage capacity cannot be negative.");
        }
    }
}
