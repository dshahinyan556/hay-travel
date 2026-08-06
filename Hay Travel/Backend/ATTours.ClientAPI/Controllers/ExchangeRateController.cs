using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.DTO.Info;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    // Курсы валют для публичного сайта. IMapper не внедряется: у вертикали нет
    // Entity -> DTO маппинга — ответ собирается из строк БД и метаданных каталога
    // (currency-pricing-sync §5).
    [ApiController]
    [Route("api/[controller]")]
    public class ExchangeRateController : Controller
    {
        #region ClientEndpoints
        // Анонимно: переключатель валют доступен всем, залогинен посетитель или нет.
        // Параметров нет: ни languageCode (переводить нечего), ни фильтра по валютам
        // (состав задан каталогом). Ручного refresh-эндпоинта тоже нет — правило 3 часов
        // покрывает обновление само.
        //
        // 503 ExchangeRatesUnavailable — единственная ошибка этого эндпоинта, и только
        // на холодном старте (курс не сохранялся ни разу). try/catch здесь не нужен:
        // ErrorModelException рендерит цепочка обработчиков.
        [HttpGet]
        [Route("GetCurrent")]
        public async Task<ExchangeRatesModel> GetCurrentAsync()
        {
            using var info = new ExchangeRateInfo();
            return await info.GetCurrentAsync();
        }
        #endregion
    }
}
