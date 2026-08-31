using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.DeleteServices
{
    // Удаление шаблона из библиотеки Notification Templates (2026-08-31). «В использовании»
    // — назначен каналу события («Настройки уведомлений») ИЛИ auth-триггеру: удаление тихо
    // снесло бы работающую отправку (та же логика, что у AdminMailbox/RoleInUse). Это НЕ
    // делает шаблон «системным» — снять назначение можно в любой момент через форму
    // события/самого шаблона, после чего он удаляется как обычная запись.
    public class NotificationTemplateDeletionService : RepositoryCoreBase<NotificationTemplate, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public NotificationTemplateDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id)
        {
            var template = await EntityRepository.AsQueryable().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                           ?? throw new ErrorModelException(GlobalErrorCode.NotificationTemplateNotFound, HttpStatusCode.NotFound,
                               $"Notification template {id} not found.");

            var info = new NotificationTemplatesInfo(Context, cancellationToken);
            var usages = await info.GetUsagesAsync(id);

            if (usages.Count > 0)
                throw new ErrorModelException(GlobalErrorCode.NotificationTemplateInUse, HttpStatusCode.Conflict,
                    $"Notification template {id} is in use and cannot be deleted. Unassign it first.");

            EntityRepository.Delete(template);
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
