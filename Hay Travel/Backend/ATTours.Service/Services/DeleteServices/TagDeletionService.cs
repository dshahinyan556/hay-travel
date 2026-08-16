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
    // Удаление тега. «В использовании» (назначен хотя бы одному туру) -> CatalogEntryInUse,
    // как ExpenseTemplateDeletionService.
    public class TagDeletionService : RepositoryCoreBase<Tag, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public TagDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id)
        {
            var tag = await EntityRepository.AsQueryable()
                                            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                      ?? throw new ErrorModelException(GlobalErrorCode.TagNotFound, HttpStatusCode.NotFound, $"Tag with id {id} not found.");

            var inUse = await Context.Set<TourTag>().AnyAsync(tourTag => tourTag.TagId == id, cancellationToken);
            if (inUse)
                throw new ErrorModelException(GlobalErrorCode.CatalogEntryInUse, HttpStatusCode.BadRequest,
                    $"Tag with id {id} is assigned to one or more tours and cannot be deleted.");

            EntityRepository.Delete(tag);
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
