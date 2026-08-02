using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.DeleteServices
{
    // Удаление шаблона расхода (3.4). «В использовании» -> CatalogEntryInUse.
    public class ExpenseTemplateDeletionService : RepositoryCoreBase<ExpenseTemplate, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public ExpenseTemplateDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id)
        {
            var template = await EntityRepository.AsQueryable()
                                                 .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                           ?? throw new ErrorModelException(GlobalErrorCode.ExpenseTemplateNotFound, HttpStatusCode.NotFound, $"Expense template with id {id} not found.");

            var inUse = await Context.Set<AdditionalExpense>().AnyAsync(expense => expense.ExpenseTemplateId == id, cancellationToken);
            if (inUse)
                throw new ErrorModelException(GlobalErrorCode.CatalogEntryInUse, HttpStatusCode.BadRequest,
                    $"Expense template with id {id} is used by one or more expenses and cannot be deleted.");

            EntityRepository.Delete(template);
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
