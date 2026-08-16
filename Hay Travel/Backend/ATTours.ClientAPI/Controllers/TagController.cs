using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Info;
using ATTours.Common.Entities;
using ATTours.Common.Extensions;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    // Каталог мерч-тегов продукта (скидка/хит сезона/…). CRUD — админ; чтение каталога
    // доступно и тур-менеджеру, который назначает теги в редакторе тура.
    [ApiController]
    [Route("api/[controller]")]
    public class TagController(IMapper mapper) : Controller
    {
        [HttpGet]
        [Route("GetAll")]
        [Authorize(Roles = ApiRoles.TourManagerOrAdmin)]
        public async Task<List<TagInfoModel>> GetAllAsync()
        {
            using var info = new TagInfo();
            var tags = await info.GetAllAsync();
            return mapper.Map<List<TagInfoModel>>(tags.OrderBy(tag => tag.SortOrder));
        }

        [HttpPost]
        [Route("Create")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task<TagInfoModel> CreateAsync([FromBody] TagCreateModel model)
        {
            var entity = mapper.Map<Tag>(model);
            using (var creationService = new TagCreationService(entity))
                await creationService.ExecuteEntityChangesAsync();

            using var info = new TagInfo();
            return mapper.Map<TagInfoModel>(await info.GetByIdAsync(entity.Id));
        }

        [HttpPut]
        [Route("Update")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task<TagInfoModel> UpdateAsync([FromBody] TagInfoModel model)
        {
            var entity = mapper.Map<Tag>(model);
            using (var updateService = new TagUpdateService(entity))
                await updateService.UpdateAsync();

            using var info = new TagInfo();
            return mapper.Map<TagInfoModel>(await info.GetByIdAsync(model.Id));
        }

        [HttpDelete]
        [Route("Delete")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task DeleteAsync([FromQuery] int id)
        {
            using var deletionService = new TagDeletionService();
            await deletionService.DeleteAsync(id);
        }

        #region ClientEndpoints
        [HttpGet]
        [Route("GetForClient")]
        public async Task<List<TagInfoModel>> GetForClientAsync([FromQuery] int languageCode)
        {
            using var info = new TagInfo();
            var tags = await info.GetAllAsync();
            return mapper.Map<List<TagInfoModel>>(
                tags.OrderBy(tag => tag.SortOrder).ExtractWithNeededLanguageFromCollection(languageCode));
        }
        #endregion
    }
}
