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
    // Каталог шаблонов доп. расходов (3.4).
    [ApiController]
    [Route("api/[controller]")]
    public class ExpenseTemplateController(IMapper mapper) : Controller
    {
        // Чтение каталога доступно и тур-менеджеру: из этих шаблонов он набирает доп. расходы
        // в редакторе тура. Правка самого каталога — только админ.
        [HttpGet]
        [Route("GetAll")]
        [Authorize(Roles = ApiRoles.TourManagerOrAdmin)]
        public async Task<List<ExpenseTemplateInfoModel>> GetAllAsync()
        {
            using var info = new ExpenseTemplateInfo();
            var templates = await info.GetAllAsync();
            return mapper.Map<List<ExpenseTemplateInfoModel>>(templates.OrderBy(template => template.SortOrder));
        }

        [HttpPost]
        [Route("Create")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task<ExpenseTemplateInfoModel> CreateAsync([FromBody] ExpenseTemplateCreateModel model)
        {
            var entity = mapper.Map<ExpenseTemplate>(model);
            using (var creationService = new ExpenseTemplateCreationService(entity))
                await creationService.ExecuteEntityChangesAsync();

            using var info = new ExpenseTemplateInfo();
            return mapper.Map<ExpenseTemplateInfoModel>(await info.GetByIdAsync(entity.Id));
        }

        [HttpPut]
        [Route("Update")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task<ExpenseTemplateInfoModel> UpdateAsync([FromBody] ExpenseTemplateInfoModel model)
        {
            var entity = mapper.Map<ExpenseTemplate>(model);
            using (var updateService = new ExpenseTemplateUpdateService(entity))
                await updateService.UpdateAsync();

            using var info = new ExpenseTemplateInfo();
            return mapper.Map<ExpenseTemplateInfoModel>(await info.GetByIdAsync(model.Id));
        }

        [HttpDelete]
        [Route("Delete")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task DeleteAsync([FromQuery] int id)
        {
            using var deletionService = new ExpenseTemplateDeletionService();
            await deletionService.DeleteAsync(id);
        }

        #region ClientEndpoints
        [HttpGet]
        [Route("GetForClient")]
        public async Task<List<ExpenseTemplateInfoModel>> GetForClientAsync([FromQuery] int languageCode)
        {
            using var info = new ExpenseTemplateInfo();
            var templates = await info.GetAllAsync();
            return mapper.Map<List<ExpenseTemplateInfoModel>>(
                templates.OrderBy(template => template.SortOrder).ExtractWithNeededLanguageFromCollection(languageCode));
        }
        #endregion
    }
}
