using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Info;
using ATTours.Common.Entities;
using ATTours.Common.Extensions;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    // Каталог шаблонов заметок тура (3.4). Порядок — по виду заметки, затем по SortOrder
    // (как заметки тура в Tour -> TourInfoModel).
    [ApiController]
    [Route("api/[controller]")]
    public class TourNoteTemplateController(IMapper mapper) : Controller
    {
        [HttpGet]
        [Route("GetAll")]
        public async Task<List<TourNoteTemplateInfoModel>> GetAllAsync()
        {
            using var info = new TourNoteTemplateInfo();
            var templates = await info.GetAllAsync();
            return mapper.Map<List<TourNoteTemplateInfoModel>>(
                templates.OrderBy(template => template.Type).ThenBy(template => template.SortOrder));
        }

        [HttpPost]
        [Route("Create")]
        public async Task<TourNoteTemplateInfoModel> CreateAsync([FromBody] TourNoteTemplateCreateModel model)
        {
            var entity = mapper.Map<TourNoteTemplate>(model);
            using (var creationService = new TourNoteTemplateCreationService(entity))
                await creationService.ExecuteEntityChangesAsync();

            using var info = new TourNoteTemplateInfo();
            return mapper.Map<TourNoteTemplateInfoModel>(await info.GetByIdAsync(entity.Id));
        }

        [HttpPut]
        [Route("Update")]
        public async Task<TourNoteTemplateInfoModel> UpdateAsync([FromBody] TourNoteTemplateInfoModel model)
        {
            var entity = mapper.Map<TourNoteTemplate>(model);
            using (var updateService = new TourNoteTemplateUpdateService(entity))
                await updateService.UpdateAsync();

            using var info = new TourNoteTemplateInfo();
            return mapper.Map<TourNoteTemplateInfoModel>(await info.GetByIdAsync(model.Id));
        }

        [HttpDelete]
        [Route("Delete")]
        public async Task DeleteAsync([FromQuery] int id)
        {
            using var deletionService = new TourNoteTemplateDeletionService();
            await deletionService.DeleteAsync(id);
        }

        #region ClientEndpoints
        [HttpGet]
        [Route("GetForClient")]
        public async Task<List<TourNoteTemplateInfoModel>> GetForClientAsync([FromQuery] int languageCode)
        {
            using var info = new TourNoteTemplateInfo();
            var templates = await info.GetAllAsync();
            return mapper.Map<List<TourNoteTemplateInfoModel>>(
                templates.OrderBy(template => template.Type).ThenBy(template => template.SortOrder)
                         .ExtractWithNeededLanguageFromCollection(languageCode));
        }
        #endregion
    }
}
