using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.Common.Authorization;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Request;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace ATTours.ClientAPI.Controllers
{
    // Библиотека шаблонов уведомлений (Notification Templates, 2026-08-31, Data Entry Form) —
    // открытый CRUD, в отличие от закрытого набора событий NotificationSettingsController.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationTemplatesController(IMapper mapper) : Controller
    {
        [HttpGet]
        [RequiresPermission(AdminScreens.NotificationTemplates, PermissionAction.View)]
        public async Task<List<NotificationTemplateInfoModel>> GetAllAsync(
            [FromQuery] NotificationPlatform? channel, [FromQuery] NotificationTemplateEntity? boundEntity,
            CancellationToken cancellationToken)
        {
            using var info = new NotificationTemplatesInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var templates = await info.GetAllAsync(channel, boundEntity);
            return mapper.Map<List<NotificationTemplateInfoModel>>(templates);
        }

        [HttpGet]
        [Route("{id:int}")]
        [RequiresPermission(AdminScreens.NotificationTemplates, PermissionAction.View)]
        public async Task<NotificationTemplateInfoModel> GetByIdAsync(int id, CancellationToken cancellationToken)
        {
            using var info = new NotificationTemplatesInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);

            var template = await info.GetByIdAsync(id)
                           ?? throw new ErrorModelException(GlobalErrorCode.NotificationTemplateNotFound, HttpStatusCode.NotFound,
                               $"Notification template {id} not found.");

            var result = mapper.Map<NotificationTemplateInfoModel>(template);
            result.Usages = await info.GetUsagesAsync(id);
            return result;
        }

        [HttpPost]
        [RequiresPermission(AdminScreens.NotificationTemplates, PermissionAction.Create)]
        public async Task<NotificationTemplateInfoModel> CreateAsync([FromBody] NotificationTemplateUpdateModel model,
            CancellationToken cancellationToken)
        {
            int id;
            using (var updateService = new NotificationTemplateUpdateService(cancellationToken))
                id = await updateService.SaveAsync(null, model);

            return await GetByIdAsync(id, cancellationToken);
        }

        [HttpPut]
        [Route("{id:int}")]
        [RequiresPermission(AdminScreens.NotificationTemplates, PermissionAction.Update)]
        public async Task<NotificationTemplateInfoModel> UpdateAsync(int id, [FromBody] NotificationTemplateUpdateModel model,
            CancellationToken cancellationToken)
        {
            using (var updateService = new NotificationTemplateUpdateService(cancellationToken))
                await updateService.SaveAsync(id, model);

            return await GetByIdAsync(id, cancellationToken);
        }

        [HttpDelete]
        [Route("{id:int}")]
        [RequiresPermission(AdminScreens.NotificationTemplates, PermissionAction.Delete)]
        public async Task DeleteAsync(int id, CancellationToken cancellationToken)
        {
            using var deletionService = new NotificationTemplateDeletionService(cancellationToken);
            await deletionService.DeleteAsync(id);
        }
    }
}
