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
    // Каталог точек (3.4). Текущий стиль контроллеров: сервисы через new + using, без DI,
    // только IMapper. Create/Update возвращают полностью заполненную Info-модель через
    // повторное чтение (нужно денормализованное RegionSlug).
    [ApiController]
    [Route("api/[controller]")]
    public class PlaceController(IMapper mapper) : Controller
    {
        // Права по ключу "catalog.places": в сиде чтение есть у тур-менеджера (из этих
        // точек он собирает маршрут в редакторе тура), правка каталога — у админа.
        [HttpGet]
        [Route("GetAll")]
        [RequiresPermission(AdminScreens.CatalogPlaces, PermissionAction.View)]
        public async Task<List<PlaceInfoModel>> GetAllAsync()
        {
            using var info = new PlaceInfo();
            var places = await info.GetAllAsync();
            return mapper.Map<List<PlaceInfoModel>>(places.OrderBy(place => place.SortOrder));
        }

        [HttpPost]
        [Route("Create")]
        [RequiresPermission(AdminScreens.CatalogPlaces, PermissionAction.Create)]
        public async Task<PlaceInfoModel> CreateAsync([FromBody] PlaceCreateModel model)
        {
            var entity = mapper.Map<Place>(model);
            using (var creationService = new PlaceCreationService(entity))
                await creationService.ExecuteEntityChangesAsync();

            using var info = new PlaceInfo();
            return mapper.Map<PlaceInfoModel>(await info.GetByIdAsync(entity.Id));
        }

        [HttpPut]
        [Route("Update")]
        [RequiresPermission(AdminScreens.CatalogPlaces, PermissionAction.Update)]
        public async Task<PlaceInfoModel> UpdateAsync([FromBody] PlaceInfoModel model)
        {
            var entity = mapper.Map<Place>(model);
            using (var updateService = new PlaceUpdateService(entity))
                await updateService.UpdateAsync();

            using var info = new PlaceInfo();
            return mapper.Map<PlaceInfoModel>(await info.GetByIdAsync(model.Id));
        }

        [HttpDelete]
        [Route("Delete")]
        [RequiresPermission(AdminScreens.CatalogPlaces, PermissionAction.Delete)]
        public async Task DeleteAsync([FromQuery] int id)
        {
            using var deletionService = new PlaceDeletionService();
            await deletionService.DeleteAsync(id);
        }

        #region ClientEndpoints
        [HttpGet]
        [Route("GetForClient")]
        public async Task<List<PlaceInfoModel>> GetForClientAsync([FromQuery] int languageCode)
        {
            using var info = new PlaceInfo();
            var places = await info.GetAllAsync();
            return mapper.Map<List<PlaceInfoModel>>(
                places.OrderBy(place => place.SortOrder).ExtractWithNeededLanguageFromCollection(languageCode));
        }
        #endregion
    }
}
