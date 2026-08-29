using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.Common.Authorization;
using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Info;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    // Справочник классов авто для трансферов (батч 2026-08-29, решение 0.7) — вкладка в
    // Справочниках. Права по ключу "catalog.vehicle-classes": структура и разметка ровно
    // такие же, как у TagController, включая анонимный GetForClient (публичная страница
    // трансфера показывает названия классов).
    [ApiController]
    [Route("api/[controller]")]
    public class VehicleClassController(IMapper mapper) : Controller
    {
        [HttpGet]
        [Route("GetAll")]
        [RequiresPermission(AdminScreens.CatalogVehicleClasses, PermissionAction.View)]
        public async Task<List<VehicleClassInfoModel>> GetAllAsync()
        {
            using var info = new VehicleClassInfo();
            var vehicleClasses = await info.GetAllAsync();
            return mapper.Map<List<VehicleClassInfoModel>>(vehicleClasses.OrderBy(vehicleClass => vehicleClass.SortOrder));
        }

        [HttpPost]
        [Route("Create")]
        [RequiresPermission(AdminScreens.CatalogVehicleClasses, PermissionAction.Create)]
        public async Task<VehicleClassInfoModel> CreateAsync([FromBody] VehicleClassCreateModel model)
        {
            var entity = mapper.Map<VehicleClass>(model);
            using (var creationService = new VehicleClassCreationService(entity))
                await creationService.ExecuteEntityChangesAsync();

            using var info = new VehicleClassInfo();
            return mapper.Map<VehicleClassInfoModel>(await info.GetByIdAsync(entity.Id));
        }

        [HttpPut]
        [Route("Update")]
        [RequiresPermission(AdminScreens.CatalogVehicleClasses, PermissionAction.Update)]
        public async Task<VehicleClassInfoModel> UpdateAsync([FromBody] VehicleClassInfoModel model)
        {
            var entity = mapper.Map<VehicleClass>(model);
            using (var updateService = new VehicleClassUpdateService(entity))
                await updateService.UpdateAsync();

            using var info = new VehicleClassInfo();
            return mapper.Map<VehicleClassInfoModel>(await info.GetByIdAsync(model.Id));
        }

        // 400 CatalogEntryInUse/2010, если класс участвует в ценах трансфера или в заказе —
        // такой класс скрывают флагом IsActive, а не удаляют.
        [HttpDelete]
        [Route("Delete")]
        [RequiresPermission(AdminScreens.CatalogVehicleClasses, PermissionAction.Delete)]
        public async Task DeleteAsync([FromQuery] int id)
        {
            using var deletionService = new VehicleClassDeletionService();
            await deletionService.DeleteAsync(id);
        }

        #region ClientEndpoints
        // Только активные классы: скрытый класс не должен появляться в выборе на сайте,
        // хотя в уже существующих ценах трансферов он остаётся.
        [HttpGet]
        [Route("GetForClient")]
        public async Task<List<VehicleClassInfoModel>> GetForClientAsync([FromQuery] int languageCode)
        {
            using var info = new VehicleClassInfo();
            var vehicleClasses = await info.GetAllAsync(x => x.IsActive);
            return mapper.Map<List<VehicleClassInfoModel>>(
                vehicleClasses.OrderBy(vehicleClass => vehicleClass.SortOrder)
                              .ExtractWithNeededLanguageFromCollection(languageCode));
        }
        #endregion
    }
}
