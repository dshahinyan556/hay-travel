using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.InitServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TourController(IMapper mapper) : Controller
    {
        [HttpGet]
        [Route("InitTour")]
        public async Task<TourCreateModel> InitTourAsync(TourType type)
        {
            var initializetionService = new TourInitializationService(type);
            return await initializetionService.InitAsync();
        }

        [HttpPost]
        [Route("CreateTour")]
        public async Task<TourCreatedModel> CreateTourAsync([FromBody] TourCreateModel model)
        {
            var entity = mapper.Map<Tour>(model);
            using var creationService = new TourCreationService(entity);
            await creationService.ExecuteEntityChangesAsync();
            return new TourCreatedModel { Id = entity.Id };
        }

        [HttpPut]
        [Route("UpdateTour")]
        public async Task<TourInfoModel> UpdateTourAsync([FromBody] TourInfoModel model)
        {
            var entity = mapper.Map<Tour>(model);
            using var updateService = new TourUpdateService(entity);
            var updated = await updateService.UpdateAsync();
            return mapper.Map<TourInfoModel>(updated);
        }

        [HttpPatch]
        [Route("SetActive")]
        public async Task SetActiveAsync([FromBody] SetTourActiveModel model)
        {
            using var activationService = new TourActivationService();
            await activationService.SetActiveAsync(model.Id, model.IsActive);
        }

        [HttpPatch]
        [Route("SetArchived")]
        public async Task SetArchivedAsync([FromBody] SetTourArchivedModel model)
        {
            using var archivalService = new TourArchivalService();
            await archivalService.SetArchivedAsync(model.Id, model.IsArchived);
        }

        [HttpDelete]
        [Route("DeleteTour")]
        public async Task DeleteTourAsync([FromQuery] int id)
        {
            using var deletionService = new TourDeletionService();
            await deletionService.DeleteAsync(id);
        }

        [HttpGet]
        [Route("GetAll")]
        public async Task<List<TourInfoModel>> GetToursAsync()
        {
            using var info = new TourInfo();
            // Основной список — только неархивные туры.
            var result = await info.GetAllAsync(x => !x.IsArchived);
            return mapper.Map<List<TourInfoModel>>(result);
        }

        [HttpGet]
        [Route("GetArchived")]
        public async Task<List<TourInfoModel>> GetArchivedToursAsync()
        {
            using var info = new TourInfo();
            var result = await info.GetAllAsync(x => x.IsArchived);
            return mapper.Map<List<TourInfoModel>>(result);
        }

        [HttpGet]
        [Route("InitUpdate")]
        public async Task<TourInfoModel> InitUpdate([FromQuery] int id)
        {
            using var info = new TourInfo();
            return mapper.Map<TourInfoModel>(await info.InitUpdate(id));
        }

        #region ClientEndpoints
        [HttpGet]
        [Route("GetToursClient")]
        public async Task<List<TourInfoModel>> GetToursAsyncClient([FromQuery] int languageCode)
        {
            using var info = new TourInfo();
            var result = await info.GetAllAsync();
            return mapper.Map<List<TourInfoModel>>(result.ExtractWithNeededLanguageFromCollection(languageCode));
        }

        [HttpGet]
        [Route("GetTourInfo")]
        public async Task<TourInfoModel> GetTourInfoAsync([FromQuery] int id, [FromQuery] int languageCode)
        {
            using var info = new TourInfo();
            return mapper.Map<TourInfoModel>((await info.InitUpdate(id)).ExtractWithNeededLanguage(languageCode));
        }
        #endregion
    }
}
