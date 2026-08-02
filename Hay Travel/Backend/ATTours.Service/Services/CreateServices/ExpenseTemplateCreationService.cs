using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.CreateServices
{
    public class ExpenseTemplateCreationService : CreateVerifiableEntityBase<ExpenseTemplate, ATToursContextFactory>
    {
        public ExpenseTemplateCreationService(ExpenseTemplate entity, CancellationToken cancellationToken = default)
            : base(entity, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
        }

        public ExpenseTemplateCreationService(ExpenseTemplate entity, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entity, context, cancellationToken)
        {
        }

        protected override IEntityValidation GetEntityValidation()
        {
            return new ExpenseTemplateValidationService(Entities, Context);
        }
    }
}
