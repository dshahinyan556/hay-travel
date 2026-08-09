using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
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
    public class AccountController(IMapper mapper) : Controller
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
            using var updateService = new UserPhoneUpdateService(cancellationToken);
            var user = await updateService.UpdatePhoneAsync(User.GetUserId(), model.PhoneNumber);
            return mapper.Map<UserInfoModel>(user);
        }
    }
}
