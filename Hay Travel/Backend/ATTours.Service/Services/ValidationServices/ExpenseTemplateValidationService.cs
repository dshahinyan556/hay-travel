using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация каталога шаблонов расходов (3.4). Проще Place: ни слага, ни региона.
    // Context-dependent для единообразия срезов и будущего DI. Единственное правило —
    // не больше одной строки перевода на язык (переводы создаются пачкой).
    internal class ExpenseTemplateValidationService : EntityValidationContextDependentBase<ExpenseTemplate, ATToursContextFactory>
    {
        public ExpenseTemplateValidationService(List<ExpenseTemplate> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                if (entity.Translations is null)
                    continue;

                var seenLanguages = new HashSet<int>();
                foreach (var translation in entity.Translations)
                {
                    if (!seenLanguages.Add((int)translation.LanguageCode))
                        throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                            $"Expense template has duplicated translations for language {(int)translation.LanguageCode}!");
                }
            }

            await Task.CompletedTask;
        }
    }
}
