using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.CreateServices
{
    // Создание правил закрытия. Основной конструктор — списковый: массовое закрытие/
    // открытие сразу нескольких дней это один запрос и одна транзакция, а не N вызовов.
    public class ClosureRuleCreationService : CreateVerifiableEntityBase<ClosureRule, ATToursContextFactory>
    {
        public ClosureRuleCreationService(List<ClosureRule> entities, CancellationToken cancellationToken = default)
            : base(entities, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
        }

        public ClosureRuleCreationService(List<ClosureRule> entities, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entities, context, cancellationToken)
        {
        }

        public ClosureRuleCreationService(ClosureRule entity, CancellationToken cancellationToken = default)
            : base(entity, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
        }

        public ClosureRuleCreationService(ClosureRule entity, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entity, context, cancellationToken)
        {
        }

        protected override IEntityValidation GetEntityValidation()
        {
            return new ClosureRuleValidationService(Entities, Context);
        }
    }
}
