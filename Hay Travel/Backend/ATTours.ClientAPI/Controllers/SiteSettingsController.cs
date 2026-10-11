using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.Common.Authorization;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SiteSettingsController(IMapper mapper) : Controller
    {
        // Каталог настроек ЭТОГО экрана с сохранёнными значениями и обоими языками.
        // Отдельного Init нет: этот метод сам играет роль init-скелета — ключи,
        // которых ещё нет в БД, приходят с Id = 0 и дефолтами каталога.
        // Отдаёт и непубличные ключи, поэтому только админ. Тур-менеджеру настройки сайта
        // не нужны: в редакторе тура они не участвуют. Публичный срез — в GetPublic.
        //
        // «Этого экрана», а не весь каталог: группы Booking/Jobs правятся на экране «Фоновые
        // задачи» (SiteSettingCatalog.BelongsToSettingsScreen) и здесь были бы вторым входом
        // в те же ключи — без подписей, без единиц измерения и без инварианта между порогами.
        [HttpGet]
        [Route("GetAll")]
        [RequiresPermission(AdminScreens.Settings, PermissionAction.View)]
        public async Task<List<SiteSettingInfoModel>> GetAllAsync()
        {
            using var info = new SiteSettingsInfo();
            var result = await info.GetMergedForSettingsScreenAsync();
            return mapper.Map<List<SiteSettingInfoModel>>(result);
        }

        // Upsert по Key. Неизвестный ключ -> 400 SiteSettingKeyUnknown
        // (состав ключей задаёт каталог в коде, ADR 002).
        [HttpPut]
        [Route("Update")]
        [RequiresPermission(AdminScreens.Settings, PermissionAction.Update)]
        public async Task<List<SiteSettingInfoModel>> UpdateAsync([FromBody] List<SiteSettingUpdateModel> models)
        {
            var entities = mapper.Map<List<SiteSetting>>(models);
            using var updateService = new SiteSettingsUpdateService(entities);
            var merged = await updateService.UpsertAsync();

            // Ответ — тот же срез, что отдаёт GetAll: экран настроек кладёт его в состояние
            // и в baseline целиком, и полный каталог вернул бы скрытые группы на экран
            // первым же сохранением. Сам upsert при этом не сужается: ключ группы Booking/Jobs
            // остаётся легальным телом (им же пользуется экран задач через свой эндпоинт).
            var visible = SiteSettingsInfo.FilterForSettingsScreen(merged);
            return mapper.Map<List<SiteSettingInfoModel>>(visible);
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
