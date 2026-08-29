using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.InitServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.Common.Authorization;
using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using System.Linq.Expressions;
using System.Net;

namespace ATTours.ClientAPI.Controllers
{
    // Доступ размечен пометодно, а не на контроллере: три эндпоинта в регионе
    // ClientEndpoints обслуживают публичный сайт и обязаны остаться анонимными.
    // Админские методы гейтятся матрицей прав по ключу "products"
    // (architecture-flexible-roles.md §0.3, §2.5): все операции над существующим туром —
    // включая SetActive/SetArchived/SetFeatured/ReorderFeatured — это products.Update.
    [ApiController]
    [Route("api/[controller]")]
    public class TourController(IMapper mapper) : Controller
    {
        [HttpGet]
        [Route("InitTour")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.View)]
        public async Task<TourCreateModel> InitTourAsync(TourType type)
        {
            var initializetionService = new TourInitializationService(type);
            return await initializetionService.InitAsync();
        }

        [HttpPost]
        [Route("CreateTour")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.Create)]
        public async Task<TourCreatedModel> CreateTourAsync([FromBody] TourCreateModel model)
        {
            var entity = mapper.Map<Tour>(model);
            using var creationService = new TourCreationService(entity);
            await creationService.ExecuteEntityChangesAsync();
            return new TourCreatedModel { Id = entity.Id };
        }

        [HttpPut]
        [Route("UpdateTour")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.Update)]
        public async Task<TourInfoModel> UpdateTourAsync([FromBody] TourInfoModel model)
        {
            var entity = mapper.Map<Tour>(model);
            using var updateService = new TourUpdateService(entity);
            var updated = await updateService.UpdateAsync();
            return mapper.Map<TourInfoModel>(updated);
        }

        [HttpPatch]
        [Route("SetActive")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.Update)]
        public async Task SetActiveAsync([FromBody] SetTourActiveModel model)
        {
            using var activationService = new TourActivationService();
            await activationService.SetActiveAsync(model.Id, model.IsActive);
        }

        [HttpPatch]
        [Route("SetArchived")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.Update)]
        public async Task SetArchivedAsync([FromBody] SetTourArchivedModel model)
        {
            using var archivalService = new TourArchivalService();
            await archivalService.SetArchivedAsync(model.Id, model.IsArchived);
        }

        // Отметка/снятие «избранного» (не больше 9 одновременно с 2026-08-29, TourFeaturedService).
        // Трансферы участвуют в избранном наравне с турами и экскурсиями (решение 0.4).
        // Было Admin-only, стало products.Update (§0.3): курирование избранного — та же
        // работа с контентом тура, которую и так ведёт тур-менеджер.
        [HttpPatch]
        [Route("SetFeatured")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.Update)]
        public async Task SetFeaturedAsync([FromBody] SetTourFeaturedModel model)
        {
            using var featuredService = new TourFeaturedService();
            await featuredService.SetFeaturedAsync(model.Id, model.IsFeatured);
        }

        // Порядок внутри избранного — полный список Id уже избранных туров в желаемом порядке.
        [HttpPatch]
        [Route("ReorderFeatured")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.Update)]
        public async Task ReorderFeaturedAsync([FromBody] ReorderFeaturedToursModel model)
        {
            using var featuredService = new TourFeaturedService();
            await featuredService.ReorderAsync(model.OrderedIds);
        }

        [HttpDelete]
        [Route("DeleteTour")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.Delete)]
        public async Task DeleteTourAsync([FromQuery] int id)
        {
            using var deletionService = new TourDeletionService();
            await deletionService.DeleteAsync(id);
        }

        [HttpGet]
        [Route("GetAll")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.View)]
        public async Task<List<TourInfoModel>> GetToursAsync()
        {
            using var info = new TourInfo();
            // Основной список — только неархивные туры.
            var result = await info.GetAllAsync(x => !x.IsArchived);
            return mapper.Map<List<TourInfoModel>>(result);
        }

        [HttpGet]
        [Route("GetArchived")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.View)]
        public async Task<List<TourInfoModel>> GetArchivedToursAsync()
        {
            using var info = new TourInfo();
            var result = await info.GetAllAsync(x => x.IsArchived);
            return mapper.Map<List<TourInfoModel>>(result);
        }

        [HttpGet]
        [Route("InitUpdate")]
        [RequiresPermission(AdminScreens.Products, PermissionAction.View)]
        public async Task<TourInfoModel> InitUpdate([FromQuery] int id)
        {
            using var info = new TourInfo();
            return mapper.Map<TourInfoModel>(await info.InitUpdate(id));
        }

        #region ClientEndpoints
        [HttpGet]
        [Route("GetToursClient")]
        public async Task<List<TourCardModel>> GetToursAsyncClient([FromQuery] int languageCode, [FromQuery] string? region = null)
        {
            using var info = new TourClientInfo();
            // Публичный эндпоинт: только опубликованные и неархивные туры, опционально
            // дополнительно отфильтрованные по slug региона (?region=). Неизвестный slug
            // отдаёт пустой список, а не 400 — параметр приходит из адресной строки.
            //
            // Трансферы из общего каталога исключены (решение 0.15 батча 2026-08-29): публично
            // они живут только на /transfers (api/Transfer) и в «Избранном» на главной.
            Expression<Func<Tour, bool>> where = x => x.Type != TourType.Transfer && x.IsActive && !x.IsArchived;
            if (!string.IsNullOrWhiteSpace(region))
                where = x => x.Type != TourType.Transfer && x.IsActive && !x.IsArchived && x.TourRegions.Any(tr => tr.Region.Slug == region);

            // Облегчённый card-граф (D-11): резолв каталога на списке не нужен, лишь одна локаль
            // тур-уровневых переводов. Тип возврата — List<TourCardModel> (было List<TourInfoModel>).
            var tours = await info.GetCardsAsync(where);
            var projected = TourOverrideProjection.ProjectCards(tours, languageCode);
            return mapper.Map<List<TourCardModel>>(projected);
        }

        // Публичная секция «избранное» на главной: только опубликованные, неархивные,
        // отмеченные IsFeatured продукты, в порядке FeaturedSortOrder. Фильтра по типу тут
        // намеренно НЕТ: трансферы участвуют в избранном наравне с турами (решение 0.4/6.8),
        // в отличие от общего каталога GetToursClient выше. Тот же облегчённый
        // card-граф, что и GetToursClient (пункт 3.5/D-11) — списку карточек не нужен весь граф.
        [HttpGet]
        [Route("GetFeaturedToursClient")]
        public async Task<List<TourCardModel>> GetFeaturedToursClientAsync([FromQuery] int languageCode)
        {
            using var info = new TourClientInfo();
            Expression<Func<Tour, bool>> where = x => x.IsActive && !x.IsArchived && x.IsFeatured;
            var tours = await info.GetCardsAsync(where);
            var ordered = tours.OrderBy(x => x.FeaturedSortOrder).ToList();
            var projected = TourOverrideProjection.ProjectCards(ordered, languageCode);
            return mapper.Map<List<TourCardModel>>(projected);
        }

        [HttpGet]
        [Route("GetTourInfo")]
        public async Task<TourInfoModel> GetTourInfoAsync([FromQuery] int id, [FromQuery] int languageCode)
        {
            using var info = new TourClientInfo();
            // Клиентский граф + переводы шаблонов каталога, чтобы резолв мог свернуть own ?? template.
            var tour = await info.GetClientDetailAsync(id);
            // Публичный эндпоинт: черновик/архив должны выглядеть так же, как
            // несуществующий id — иначе по ответу можно узнать о существовании тура.
            // Трансфер здесь тоже 404: у него своя публичная детальная
            // (api/Transfer/GetTransferInfo) со своей моделью — отдавать его как тур значило
            // бы вернуть продукт с пустыми днями/регионами/тегами и без маршрута и цен.
            if (tour is { Type: TourType.Transfer })
                tour = null;

            if (tour is not { IsActive: true, IsArchived: false })
            {
                throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.NotFound, $"Tour with id {id} not found.");
            }

            // Резолв own(lang) ?? template(lang) у каталог-привязанных строк (D-9/D-10), в Service.
            return mapper.Map<TourInfoModel>(TourOverrideProjection.ResolveDetail(tour, languageCode));
        }
        #endregion
    }
}
