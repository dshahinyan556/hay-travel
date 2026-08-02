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
    // Удаление шаблона заметки (3.4). «В использовании» -> CatalogEntryInUse.
    public class TourNoteTemplateDeletionService : RepositoryCoreBase<TourNoteTemplate, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public TourNoteTemplateDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id)
        {
            var template = await EntityRepository.AsQueryable()
                                                 .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                           ?? throw new ErrorModelException(GlobalErrorCode.TourNoteTemplateNotFound, HttpStatusCode.NotFound, $"Tour note template with id {id} not found.");

            var inUse = await Context.Set<TourNote>().AnyAsync(note => note.TourNoteTemplateId == id, cancellationToken);
            if (inUse)
                throw new ErrorModelException(GlobalErrorCode.CatalogEntryInUse, HttpStatusCode.BadRequest,
                    $"Tour note template with id {id} is used by one or more notes and cannot be deleted.");

            EntityRepository.Delete(template);
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
