using ATTours.BusinessServices.Geo;
using ATTours.Common.DTO.Geo;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    // Гео по IP (B2, 2026-08-09). Анонимный: эндпоинт нужен форме регистрации, то есть до
    // того, как у посетителя вообще появился аккаунт.
    //
    // Сервис приходит через конструктор (ADR 005) — IGeoIpLookup зарегистрирован
    // singleton'ом и владеет открытым файлом базы, создавать его через `new` нельзя.
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous]
    public class GeoController(IGeoIpLookup geoIpLookup) : Controller
    {
        [HttpGet]
        [Route("Country")]
        public IpCountryModel GetCountry()
        {
            // Адрес берётся из соединения, а не из тела/query: сообщать «чей» IP определять —
            // не задача клиента.
            var location = geoIpLookup.Lookup(HttpContext.Connection.RemoteIpAddress?.ToString());

            // Неизвестный адрес отвечает 200 с пустыми полями, а не 404: для фронта это не
            // ошибка, а «дефолт дропдауна выбирай сам».
            return new IpCountryModel
            {
                CountryCode = location?.CountryCode,
                CountryName = location?.CountryName,
                City = location?.City
            };
        }
    }
}
