using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.BusinessServices.Telegram;
using ATTours.ClientAPI.Extensions;
using ATTours.Common.DTO.Account;
using ATTours.Common.DTO.Auth;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace ATTours.ClientAPI.Controllers
{
    // Личный кабинет (A4, 2026-08-09): self-service правка собственных profile-данных.
    // Отдельно от AuthController — телефон не является credential'ом и не меняет состояние
    // аутентификации (сессии не отзываются, письма не уходят).
    //
    // Id пользователя всегда берётся из токена, никогда из тела запроса: иначе эндпоинт
    // стал бы админским по факту.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AccountController(IMapper mapper, ITelegramLinkService telegramLinkService) : Controller
    {
        // Собственный профиль (A1/A6, 2026-08-09). Нужен потому, что AuthUser во фронте
        // собирается декодом JWT (ADR-007), а в токене нет ни имени/фамилии, ни телефона —
        // /account обязан их показать и подставить текущий номер в форму его смены.
        //
        // Отдельно от GET api/Users/{id}: тот админский ([Authorize(Roles = "Admin")]) и
        // отдаёт чужие карточки. Здесь id берётся только из токена, поэтому IDOR невозможен
        // по конструкции — параметров у эндпоинта нет.
        [HttpGet]
        [Route("Me")]
        public async Task<UserInfoModel> GetMeAsync(CancellationToken cancellationToken)
        {
            using var info = new UserInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);

            // GetByIdAsync уже фильтрует !IsDeleted и включает Role (см. UserInfo).
            var user = await info.GetByIdAsync(User.GetUserId(), cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           "User not found.");

            return mapper.Map<UserInfoModel>(user);
        }

        [HttpPatch]
        [Route("Phone")]
        public async Task<UserInfoModel> UpdatePhoneAsync([FromBody] UpdatePhoneModel model, CancellationToken cancellationToken)
        {
            // Оба id — из токена и всегда совпадают: эндпоинт self-service. Второй нужен
            // SuperAdminGuard'у внутри сервиса (см. комментарий там).
            var currentUserId = User.GetUserId();

            using var updateService = new UserPhoneUpdateService(cancellationToken);
            var user = await updateService.UpdatePhoneAsync(currentUserId, model.PhoneNumber, currentUserId);
            return mapper.Map<UserInfoModel>(user);
        }

        // Личные предпочтения (2026-08-29): тема, палитра, валюта, язык, каналы уведомлений.
        // У гостя они живут в localStorage и привязаны к браузеру — у залогиненного источник
        // правды здесь, чтобы выбор переезжал на другое устройство.
        //
        // Отдаёт СЫРЫЕ значения, включая null: дефолты сайта не подмешиваются намеренно —
        // фронт получает их из публичных настроек и обязан отличать «выбрано dark» от
        // «выбора нет» (иначе экран перестанет следовать за админской сменой дефолта).
        [HttpGet]
        [Route("Preferences")]
        public async Task<UserPreferencesModel> GetPreferencesAsync(CancellationToken cancellationToken)
        {
            using var info = new UserInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);

            var user = await info.GetByIdAsync(User.GetUserId(), cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           "User not found.");

            return mapper.Map<UserPreferencesModel>(user);
        }

        // PUT, а не PATCH: тело содержит ВСЕ пять значений и перезаписывает их целиком,
        // null = «сбросить к дефолту сайта» (см. UpdatePreferencesModel). Фронт всегда
        // держит полный набор в памяти, поэтому дробить это на пять патчей незачем.
        [HttpPut]
        [Route("Preferences")]
        public async Task<UserPreferencesModel> UpdatePreferencesAsync([FromBody] UpdatePreferencesModel model,
            CancellationToken cancellationToken)
        {
            using var updateService = new UserPreferencesUpdateService(cancellationToken);
            var user = await updateService.UpdateAsync(model, User.GetUserId());

            // Возвращается сохранённое состояние, а не эхо запроса: фронт кладёт ответ в
            // свой стор и так видит результат нормализации (например "usd" -> "USD").
            return mapper.Map<UserPreferencesModel>(user);
        }

        // Привязка Telegram (ADR 031). Все три эндпоинта self-service: id — только из токена,
        // как и у остального AccountController, поэтому чужую привязку ими не достать.
        //
        // ITelegramLinkService приходит из DI, а не создаётся через `new`: ему нужны
        // TelegramSettings и логгер (то же исключение, что у auth/notification-вертикали,
        // ADR 005).
        [HttpGet]
        [Route("Telegram")]
        public Task<TelegramLinkStatusModel> GetTelegramStatusAsync(CancellationToken cancellationToken)
            => telegramLinkService.GetStatusAsync(User.GetUserId(), cancellationToken);

        // POST, а не GET: каждый вызов выпускает новый код и обесценивает предыдущий.
        //
        // BuildRequestContext() — тот же аудит-контракт, что у auth-флоу: код ложится в
        // UserToken, где RequestIp NOT NULL, поэтому без него INSERT падает (см. сервис).
        [HttpPost]
        [Route("Telegram/LinkCode")]
        public Task<TelegramLinkCodeModel> IssueTelegramLinkCodeAsync(CancellationToken cancellationToken)
            => telegramLinkService.IssueLinkCodeAsync(User.GetUserId(), HttpContext.BuildRequestContext(), cancellationToken);

        [HttpDelete]
        [Route("Telegram")]
        public async Task<IActionResult> UnlinkTelegramAsync(CancellationToken cancellationToken)
        {
            await telegramLinkService.UnlinkAsync(User.GetUserId(), cancellationToken);
            return NoContent();
        }

        // Справочник способов связи (батч 2026-08-29). Self-service, как и остальной
        // AccountController: userId только из токена, поэтому чужой контакт этими
        // эндпоинтами не достать. Правка/удаление строки НЕ меняют уже созданные заказы —
        // там лежит снимок значений (ADR 032).
        [HttpGet]
        [Route("Contacts")]
        public async Task<List<ContactMethodInfoModel>> GetContactsAsync(CancellationToken cancellationToken)
        {
            using var info = new UserContactMethodInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);

            // Порядок (основной первым) задаёт сервис, а не фронт: тот же справочник в том
            // же порядке предзаполняет форму заказа.
            return mapper.Map<List<ContactMethodInfoModel>>(await info.GetByUserAsync(User.GetUserId(), cancellationToken));
        }

        [HttpPost]
        [Route("Contacts")]
        public async Task<ContactMethodInfoModel> CreateContactAsync([FromBody] ContactMethodCreateModel model,
            CancellationToken cancellationToken)
        {
            var entity = mapper.Map<UserContactMethod>(model);

            // UserId, нормализация значения и снятие флага «основной» у остальных строк —
            // всё внутри сервиса: контроллер доменных решений не принимает.
            using var creationService = new UserContactMethodCreationService(entity, User.GetUserId(), cancellationToken);
            await creationService.ExecuteEntityChangesAsync();

            return mapper.Map<ContactMethodInfoModel>(creationService.Entities.Single());
        }

        [HttpPut]
        [Route("Contacts")]
        public async Task<ContactMethodInfoModel> UpdateContactAsync([FromBody] ContactMethodUpdateModel model,
            CancellationToken cancellationToken)
        {
            using var updateService = new UserContactMethodUpdateService(cancellationToken);
            var contact = await updateService.UpdateAsync(model, User.GetUserId());

            return mapper.Map<ContactMethodInfoModel>(contact);
        }

        [HttpDelete]
        [Route("Contacts")]
        public async Task<IActionResult> DeleteContactAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var deletionService = new UserContactMethodDeletionService(cancellationToken);
            await deletionService.DeleteAsync(id, User.GetUserId());

            return NoContent();
        }

        // Отдаёт справочник ЦЕЛИКОМ, а не одну строку: смена основного меняет флаг сразу у
        // двух записей и порядок всего списка — второй round-trip «а кто теперь основной»
        // экрану не нужен.
        [HttpPatch]
        [Route("Contacts/SetPrimary")]
        public async Task<List<ContactMethodInfoModel>> SetPrimaryContactAsync([FromQuery] int id,
            CancellationToken cancellationToken)
        {
            using (var updateService = new UserContactMethodUpdateService(cancellationToken))
                await updateService.SetPrimaryAsync(id, User.GetUserId());

            using var info = new UserContactMethodInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return mapper.Map<List<ContactMethodInfoModel>>(await info.GetByUserAsync(User.GetUserId(), cancellationToken));
        }
    }
}
