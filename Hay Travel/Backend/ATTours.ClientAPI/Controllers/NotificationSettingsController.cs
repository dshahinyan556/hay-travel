using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.Common.Authorization;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Request;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace ATTours.ClientAPI.Controllers
{
    // Раздел «Настройки уведомлений» (редизайн 2026-08-23): грид событий, внутри каждого —
    // вкладки платформ с рубильником, WYSIWYG-шаблоном (билингвальным) и списком получателей.
    // Заменяет EmailTemplateController: получатели перестали быть константой кода.
    //
    // Гейтится ключом notifications — обычный экран матрицы (решение Давида 2026-08-22),
    // не жёсткий Admin-only мета-экран: Create/Delete событий нет, набор из 4 фиксирован.
    //
    // Стиль контроллеров проекта: сервисы через new + using, в конструкторе только IMapper.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationSettingsController(IMapper mapper) : Controller
    {
        // Все 4 события разом, с платформами/шаблонами/получателями: раздел показывает их
        // одним списком, второго запроса на каждый ключ не требуется.
        [HttpGet]
        [RequiresPermission(AdminScreens.Notifications, PermissionAction.View)]
        public async Task<List<NotificationEventInfoModel>> GetAllAsync(CancellationToken cancellationToken)
        {
            using var info = new NotificationSettingsInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return mapper.Map<List<NotificationEventInfoModel>>(await info.GetEventsAsync());
        }

        // Одно событие. Неизвестный ключ — 404: набор событий закрыт кодом (EmailPlaceholders),
        // и «пустое событие» отдавать нельзя.
        [HttpGet]
        [Route("{eventKey:int}")]
        [RequiresPermission(AdminScreens.Notifications, PermissionAction.View)]
        public async Task<NotificationEventInfoModel> GetByKeyAsync(int eventKey, CancellationToken cancellationToken)
        {
            using var info = new NotificationSettingsInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var events = await info.GetEventsAsync((EmailActionKey)eventKey);

            var view = events.FirstOrDefault()
                       ?? throw new ErrorModelException(GlobalErrorCode.EmailTemplateInvalid, HttpStatusCode.NotFound,
                           $"Notification event for key {eventKey} not found.");

            return mapper.Map<NotificationEventInfoModel>(view);
        }

        // Сохранение события целиком: рубильники платформ + шаблон + ПОЛНЫЙ набор получателей.
        // BodyHtml санитизируется на сохранении — в ответе приходит уже очищенный HTML,
        // чтобы редактор показал ровно то, что легло в БД.
        [HttpPut]
        [RequiresPermission(AdminScreens.Notifications, PermissionAction.Update)]
        public async Task<NotificationEventInfoModel> UpdateAsync([FromBody] NotificationEventUpdateModel model,
            CancellationToken cancellationToken)
        {
            using (var updateService = new NotificationSettingsUpdateService(cancellationToken))
                await updateService.SaveEventAsync(model);

            // Перечитываем: у только что созданных строк-получателей нет Id, а гриду он нужен,
            // чтобы следующее сохранение отличило правку от вставки.
            using var info = new NotificationSettingsInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var events = await info.GetEventsAsync(model.EventKey);

            return mapper.Map<NotificationEventInfoModel>(events.First());
        }
    }
}
