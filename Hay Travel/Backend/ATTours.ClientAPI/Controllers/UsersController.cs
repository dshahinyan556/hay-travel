using ATTours.BusinessServices.Services.AuthServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.ClientAPI.Extensions;
using ATTours.Common.Authorization;
using ATTours.Common.DTO.Auth;
using ATTours.Common.DTO.Authorization;
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
    // Управление учётками. Гейтится ключом прав "users" пометодно (было
    // [Authorize(Roles="Admin")] на контроллере): [Authorize] здесь отвечает только за
    // аутентификацию. Поверх матрицы остаются SuperAdmin-guard'ы внутри сервисов — они к
    // правам экрана отношения не имеют (architecture-flexible-roles.md §0.5). С 2026-08-27
    // такой guard стоит на КАЖДОЙ операции записи по чужой строке User, поэтому все они
    // получают User.GetUserId(): по правам экрана «Пользователи» админ может всё, кроме
    // учётки SuperAdmin'а.
    //
    // IAuthService — единственное исключение из «сервисы через new»: impersonation отзывает
    // сессии и выпускает токены, а это домен AuthService, живущего на конструкторном DI
    // (ADR 005/028).
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController(IMapper mapper, IAuthService authService) : Controller
    {
        [HttpGet]
        [RequiresPermission(AdminScreens.Users, PermissionAction.View)]
        public async Task<List<UserInfoModel>> GetUsersAsync(CancellationToken cancellationToken)
        {
            using var info = new UserInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var users = await info.GetAllAsync();
            return mapper.Map<List<UserInfoModel>>(users);
        }

        // Деталь пользователя (B13, 2026-08-06): IP/LastActiveAtUtc/RegisteredAtUtc не
        // уходят на клиент при каждой загрузке таблицы — только при открытии карточки.
        [HttpGet]
        [Route("{id:int}")]
        [RequiresPermission(AdminScreens.Users, PermissionAction.View)]
        public async Task<UserDetailInfoModel> GetUserByIdAsync(int id, CancellationToken cancellationToken)
        {
            using var info = new UserInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var user = await info.GetByIdAsync(id, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"User with id {id} not found.");
            return mapper.Map<UserDetailInfoModel>(user);
        }

        // История входов пользователя (C2, 2026-08-09) — только админская вьюха: на публичном
        // /account эта секция не показывается по прямому решению Давида.
        [HttpGet]
        [Route("{id:int}/LoginHistory")]
        [RequiresPermission(AdminScreens.Users, PermissionAction.View)]
        public async Task<List<LoginHistoryModel>> GetLoginHistoryAsync(int id, CancellationToken cancellationToken)
        {
            using var info = new LoginHistoryInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var loginHistory = await info.GetForUserAsync(id, cancellationToken: cancellationToken);
            return mapper.Map<List<LoginHistoryModel>>(loginHistory);
        }

        // actingUserId (D3/D4, 2026-08-09) вернулся в сигнатуру: кто именно меняет роль,
        // теперь определяет исход — админские роли доступны только SuperAdmin'у, и свою
        // собственную он тоже менять не может.
        [HttpPatch]
        [Route("ChangeRole")]
        [RequiresPermission(AdminScreens.Users, PermissionAction.Update)]
        public async Task<UserInfoModel> ChangeRoleAsync([FromBody] ChangeRoleModel model, CancellationToken cancellationToken)
        {
            using var updateService = new UserRoleUpdateService(cancellationToken);
            var user = await updateService.ChangeRoleAsync(User.GetUserId(), model.UserId, model.RoleId);
            return mapper.Map<UserInfoModel>(user);
        }

        // Рабочая специализация сотрудника по умолчанию (Задача D). JobRole == null —
        // «снять роль по умолчанию»: поле не обязательно, обязателен лишь выбор роли
        // в момент самого назначения на строку заказа.
        [HttpPatch]
        [Route("SetJobRole")]
        [RequiresPermission(AdminScreens.Users, PermissionAction.Update)]
        public async Task<UserInfoModel> SetJobRoleAsync([FromBody] SetUserJobRoleModel model, CancellationToken cancellationToken)
        {
            using var updateService = new UserJobRoleUpdateService(cancellationToken);
            var user = await updateService.UpdateJobRoleAsync(model.UserId, model.JobRole, User.GetUserId());
            return mapper.Map<UserInfoModel>(user);
        }

        // Язык писем пользователя (редизайн 2026-08-23): по нему notification-сервис выбирает
        // языковую версию шаблона. Значение вне диапазона enum не отбивается ошибкой —
        // у языка есть безопасный дефолт (Russian), см. UserPreferredLanguageUpdateService.
        [HttpPatch]
        [Route("SetPreferredLanguage")]
        [RequiresPermission(AdminScreens.Users, PermissionAction.Update)]
        public async Task<UserInfoModel> SetPreferredLanguageAsync([FromBody] SetUserPreferredLanguageModel model,
            CancellationToken cancellationToken)
        {
            using var updateService = new UserPreferredLanguageUpdateService(cancellationToken);
            var user = await updateService.UpdateLanguageAsync(model.UserId, model.PreferredLanguage, User.GetUserId());
            return mapper.Map<UserInfoModel>(user);
        }

        // Soft-delete (B4, 2026-08-06). Нельзя удалить самого себя — см. UserDeletionService.
        [HttpDelete]
        [Route("Delete")]
        [RequiresPermission(AdminScreens.Users, PermissionAction.Delete)]
        public async Task DeleteUserAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var deletionService = new UserDeletionService(cancellationToken);
            await deletionService.DeleteAsync(id, User.GetUserId());
        }

        // Ставит ForceToChangePass=true и возвращает обновлённого юзера (B5, 2026-08-06) —
        // фронту не нужен второй GET. actingUserId (2026-08-27): операция по последствиям
        // равна захвату учётки, поэтому защищена теми же guard'ами, что и удаление.
        [HttpPost]
        [Route("ForcePasswordReset")]
        [RequiresPermission(AdminScreens.Users, PermissionAction.Update)]
        public async Task<UserInfoModel> ForcePasswordResetAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var resetService = new UserForcePasswordResetService(cancellationToken);
            var user = await resetService.ForceResetAsync(id, User.GetUserId());
            return mapper.Map<UserInfoModel>(user);
        }

        // Письмо со ссылкой на сброс пароля клиенту (2026-08-27). Не путать с
        // ForcePasswordReset выше: тот только поднимает флаг, письмо не уходит.
        // Ответ здесь обычный (не generic, как у ForgotPassword) — адресат админу известен,
        // скрывать существование учётки не от кого.
        [HttpPost]
        [Route("SendPasswordResetEmail")]
        [RequiresPermission(AdminScreens.Users, PermissionAction.Update)]
        public async Task<MessageResultModel> SendPasswordResetEmailAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            // Кто действует — только из токена: значение из тела/query здесь обошло бы
            // SuperAdmin-guard внутри сервиса.
            using var resetService = new UserAdminPasswordResetService(authService, cancellationToken);
            return await resetService.SendPasswordResetEmailAsync(id, User.GetUserId(), HttpContext.BuildRequestContext());
        }

        // Персональные права поверх роли (architecture-flexible-roles.md §3.6) — часть
        // экрана «Пользователи», поэтому гейтятся его же ключом. Отдаются только реально
        // заведённые строки: экран без override наследует роль целиком.
        [HttpGet]
        [Route("{id:int}/PermissionOverrides")]
        [RequiresPermission(AdminScreens.Users, PermissionAction.View)]
        public async Task<List<ScreenOverrideModel>> GetPermissionOverridesAsync(int id, CancellationToken cancellationToken)
        {
            using var info = new UserPermissionOverrideInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return mapper.Map<List<ScreenOverrideModel>>(await info.GetForUserAsync(id));
        }

        // Перезаписывает набор override целиком: экран, которого нет в теле (или у которого
        // все четыре флага null), снова наследует роль.
        [HttpPut]
        [Route("{id:int}/PermissionOverrides")]
        [RequiresPermission(AdminScreens.Users, PermissionAction.Update)]
        public async Task<List<ScreenOverrideModel>> PutPermissionOverridesAsync(int id,
            [FromBody] UserPermissionOverrideSaveModel model, CancellationToken cancellationToken)
        {
            // Целевой пользователь — всегда из маршрута, никогда из тела (IDOR).
            using var updateService = new UserPermissionOverrideUpdateService(cancellationToken);
            return mapper.Map<List<ScreenOverrideModel>>(await updateService.SaveAsync(id, model, User.GetUserId()));
        }

        // «Войти как пользователь» (spec 014 §3, ADR 028/030). Гейтится не матрицей, а
        // отдельной привилегией can_impersonate: это сквозное право, а не действие над
        // экраном. Операция односторонняя — ВСЕ сессии вызывающего гасятся, его уже выданные
        // access-токены мгновенно объявляются мёртвыми, обратно он попадает только логином.
        [HttpPost]
        [Route("{id:int}/Impersonate")]
        [RequiresImpersonate]
        public async Task<LoginResultModel> ImpersonateAsync(int id, CancellationToken cancellationToken)
        {
            // Целевой пользователь — ВСЕГДА из маршрута (IDOR-safe).
            var outcome = await authService.ImpersonateAsync(User.GetUserId(), id,
                HttpContext.BuildRequestContext(), cancellationToken);

            // Перезаписывает refresh-cookie админа cookie'й цели — прежней сессии больше
            // нет ни на сервере, ни в браузере. Всегда сессионная: rememberMe = false.
            RefreshTokenCookie.Set(Response, outcome.RefreshToken, rememberMe: false);

            return outcome.Result;
        }
    }
}
