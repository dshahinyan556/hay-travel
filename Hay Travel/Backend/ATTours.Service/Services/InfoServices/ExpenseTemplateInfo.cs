using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение каталога шаблонов доп. расходов (3.4).
    public class ExpenseTemplateInfo : EntityInfoBase<ExpenseTemplate>
    {
        public ExpenseTemplateInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public ExpenseTemplateInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public ExpenseTemplateInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        protected override IEntityQueryableRepository<ExpenseTemplate> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository().Include(x => x.Translations);
        }

        public async Task<ExpenseTemplate> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }
    }
}
