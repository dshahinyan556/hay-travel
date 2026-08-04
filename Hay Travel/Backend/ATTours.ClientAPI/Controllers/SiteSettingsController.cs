using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SiteSettingsController(IMapper mapper) : Controller
    {
        // Полный каталог настроек с сохранёнными значениями и обоими языками.
        // Отдельного Init нет: этот метод сам играет роль init-скелета — ключи,
        // которых ещё нет в БД, приходят с Id = 0 и дефолтами каталога.
        // Отдаёт и непубличные ключи, поэтому только админ. Тур-менеджеру настройки сайта
        // не нужны: в редакторе тура они не участвуют. Публичный срез — в GetPublic.
        [HttpGet]
        [Route("GetAll")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task<List<SiteSettingInfoModel>> GetAllAsync()
        {
            using var info = new SiteSettingsInfo();
            var result = await info.GetMergedAsync();
            return mapper.Map<List<SiteSettingInfoModel>>(result);
        }

        // Upsert по Key. Неизвестный ключ -> 400 SiteSettingKeyUnknown
        // (состав ключей задаёт каталог в коде, ADR 002).
        [HttpPut]
        [Route("Update")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task<List<SiteSettingInfoModel>> UpdateAsync([FromBody] List<SiteSettingUpdateModel> models)
        {
            var entities = mapper.Map<List<SiteSetting>>(models);
            using var updateService = new SiteSettingsUpdateService(entities);
            var merged = await updateService.UpsertAsync();
            return mapper.Map<List<SiteSettingInfoModel>>(merged);
        }

        #region ClientEndpoints
        // Публичное чтение: только публичные ключи, одна локаль.
        // Значение уже разрешено (перевод ?? Value ?? дефолт), null не возвращается.
        [HttpGet]
        [Route("GetPublic")]
        public async Task<SiteSettingsPublicModel> GetPublicAsync([FromQuery] int languageCode, [FromQuery] SiteSettingGroup? group = null)
        {
            using var info = new SiteSettingsInfo();
            return new SiteSettingsPublicModel
            {
                LanguageCode = languageCode,
                Values = await info.GetPublicAsync(languageCode, group)
            };
        }
        #endregion
    }
}
