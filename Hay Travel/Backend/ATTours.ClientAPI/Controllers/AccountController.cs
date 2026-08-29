using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.BusinessServices.Telegram;
using ATTours.ClientAPI.Extensions;
using ATTours.Common.DTO.Account;
using ATTours.Common.DTO.Auth;
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
        [HttpPost]
        [Route("Telegram/LinkCode")]
        public Task<TelegramLinkCodeModel> IssueTelegramLinkCodeAsync(CancellationToken cancellationToken)
            => telegramLinkService.IssueLinkCodeAsync(User.GetUserId(), cancellationToken);

        [HttpDelete]
        [Route("Telegram")]
        public async Task<IActionResult> UnlinkTelegramAsync(CancellationToken cancellationToken)
        {
            await telegramLinkService.UnlinkAsync(User.GetUserId(), cancellationToken);
            return NoContent();
        }
    }
}
