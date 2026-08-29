using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.DTO.Info;
using ATTours.Common.Extensions;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace ATTours.ClientAPI.Controllers
{
    // ПУБЛИЧНЫЕ эндпоинты предопределённых трансферов (батч 2026-08-29, решение 0.15):
    // трансферы видны только на /transfers (+ секция «Избранное» на главной, её отдаёт
    // api/Tour/GetFeaturedToursClient), в общий каталог туров/экскурсий они не попадают.
    //
    // Админский CRUD трансфера остаётся в TourController: трансфер это TourType, а не
    // отдельная сущность (решение 0.2), и форма продукта у него та же. Отдельный контроллер
    // здесь — только потому, что ПУБЛИЧНАЯ read-модель другая (маршрут и цены по классам
    // авто вместо дней, регионов и тегов), см. TransferInfoModel.
    //
    // Оба метода анонимные — как ClientEndpoints в TourController.
    [ApiController]
    [Route("api/[controller]")]
    public class TransferController(IMapper mapper) : Controller
    {
        [HttpGet]
        [Route("GetTransfersClient")]
        public async Task<List<TransferCardModel>> GetTransfersClientAsync([FromQuery] int languageCode)
        {
            using var info = new TransferClientInfo();
            var transfers = await info.GetCardsAsync();
            return mapper.Map<List<TransferCardModel>>(transfers.ExtractTransfersWithNeededLanguageFromCollection(languageCode));
        }

        [HttpGet]
        [Route("GetTransferInfo")]
        public async Task<TransferInfoModel> GetTransferInfoAsync([FromQuery] int id, [FromQuery] int languageCode)
        {
            using var info = new TransferClientInfo();
            var transfer = await info.GetDetailAsync(id);

            // Черновик/архив выглядят так же, как несуществующий id — иначе по ответу можно
            // узнать о существовании неопубликованного продукта (то же правило, что в
            // TourController.GetTourInfo). Не-трансфер сюда не доедет: фильтр по типу стоит
            // в самой read-модели.
            if (transfer is not { IsActive: true, IsArchived: false })
                throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.NotFound, $"Transfer with id {id} not found.");

            return mapper.Map<TransferInfoModel>(transfer.ExtractTransferWithNeededLanguage(languageCode));
        }
    }
}
