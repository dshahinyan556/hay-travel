using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Extensions;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RegionController(IMapper mapper) : Controller
    {
        // Административный список: оба языка, TourCount по правилу публичной витрины.
        // Имя/слаг/SortOrder региона заведены сидом (SeedArmenianRegions) и здесь не редактируются;
        // единственное редактируемое поле — тизер (Blurb), см. UpdateBlurb.
        [HttpGet]
        [Route("GetAll")]
        public async Task<List<RegionInfoModel>> GetAllAsync()
        {
            using var info = new RegionInfo();
            var regions = await info.GetAllAsync();
            var counts = await info.GetPublicTourCountsAsync();

            return MapWithCounts(regions.OrderBy(r => r.SortOrder), counts);
        }

        // Правит только RegionTranslationType.Blurb (RU+EN) у одного региона.
        [HttpPut]
        [Route("UpdateBlurb")]
        public async Task UpdateBlurbAsync([FromBody] UpdateRegionBlurbModel model)
        {
            using var updateService = new RegionBlurbUpdateService();
            await updateService.UpdateBlurbAsync(model.Id, model.BlurbRu, model.BlurbEn);
        }

        #region ClientEndpoints
        // Публичный список: одна локаль, TourCount по правилу публичной витрины
        // (та же самая, что используется для фильтра ?region= в GetToursClient).
        [HttpGet]
        [Route("GetRegionsClient")]
        public async Task<List<RegionInfoModel>> GetRegionsClientAsync([FromQuery] int languageCode)
        {
            using var info = new RegionInfo();
            var regions = await info.GetAllAsync();
            var counts = await info.GetPublicTourCountsAsync();

            return MapWithCounts(regions.OrderBy(r => r.SortOrder).ExtractWithNeededLanguageFromCollection(languageCode), counts);
        }
        #endregion

        private List<RegionInfoModel> MapWithCounts(IEnumerable<Region> regions, Dictionary<int, int> counts)
        {
            var models = mapper.Map<List<RegionInfoModel>>(regions);
            foreach (var model in models)
                model.TourCount = counts.GetValueOrDefault(model.Id);

            return models;
        }
    }
}
