using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.ClientAPI.Extensions;
using ATTours.Common.Authorization;
using ATTours.Common.DTO.Authorization;
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
    // Управление ролями и их матрицей прав. Гейтится ключом roles — обычный экран матрицы,
    // а не жёсткий Admin-only мета-экран (решение Давида 2026-08-22): любая роль может как
    // получить, так и потерять сюда доступ, точно так же, как к любому другому экрану.
    // Единственный СВЕРХ-матрицы гейт — RoleSaveModel.CanManageAdmins: его меняет только
    // SuperAdmin (проверка внутри RoleCreationService/RoleUpdateService, не здесь).
    //
    // Стиль контроллеров проекта: сервисы через new + using, в конструкторе только IMapper.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RolesController(IMapper mapper) : Controller
    {
        [HttpGet]
        [RequiresPermission(AdminScreens.Roles, PermissionAction.View)]
        public async Task<List<RoleInfoModel>> GetAllAsync(CancellationToken cancellationToken)
        {
            using var info = new RoleInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var roles = await info.GetAllAsync();
            var userCounts = await info.GetUserCountsAsync(cancellationToken);

            var models = mapper.Map<List<RoleInfoModel>>(roles.OrderBy(role => role.Id));
            foreach (var model in models)
                model.UserCount = userCounts.GetValueOrDefault(model.Id);

            return models;
        }

        [HttpPost]
        [RequiresPermission(AdminScreens.Roles, PermissionAction.Create)]
        public async Task<RoleInfoModel> CreateAsync([FromBody] RoleSaveModel model, CancellationToken cancellationToken)
        {
            int roleId;
            using (var creationService = new RoleCreationService(cancellationToken))
                roleId = (await creationService.CreateAsync(model, User.GetUserId())).Id;

            return await ReadAsync(roleId, cancellationToken);
        }

        [HttpPut]
        [Route("{id:int}")]
        [RequiresPermission(AdminScreens.Roles, PermissionAction.Update)]
        public async Task<RoleInfoModel> UpdateAsync(int id, [FromBody] RoleSaveModel model, CancellationToken cancellationToken)
        {
            // Целевая роль — всегда из маршрута; Id в теле носит справочный характер.
            using (var updateService = new RoleUpdateService(cancellationToken))
                await updateService.UpdateAsync(id, model, User.GetUserId());

            return await ReadAsync(id, cancellationToken);
        }

        [HttpDelete]
        [Route("{id:int}")]
        [RequiresPermission(AdminScreens.Roles, PermissionAction.Delete)]
        public async Task<IActionResult> DeleteAsync(int id, CancellationToken cancellationToken)
        {
            using var deletionService = new RoleDeletionService(cancellationToken);
            await deletionService.DeleteAsync(id);
            return NoContent();
        }

        // Перечитываем после записи: матрица в ответе должна быть развёрнута по всем
        // экранам реестра (это делает AfterMap профиля), а не только по сохранённым строкам.
        private async Task<RoleInfoModel> ReadAsync(int id, CancellationToken cancellationToken)
        {
            using var info = new RoleInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var role = await info.GetByIdAsync(id, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RoleNotFound, HttpStatusCode.NotFound,
                           $"Role with id {id} not found.");

            var model = mapper.Map<RoleInfoModel>(role);
            var userCounts = await info.GetUserCountsAsync(cancellationToken);
            model.UserCount = userCounts.GetValueOrDefault(id);

            return model;
        }
    }
}
