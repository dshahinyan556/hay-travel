using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Extensions;
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
    // Управление учётками — только для администратора: смена роли повышает привилегии.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class UsersController(IMapper mapper) : Controller
    {
        [HttpGet]
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
        public async Task<UserInfoModel> ChangeRoleAsync([FromBody] ChangeRoleModel model, CancellationToken cancellationToken)
        {
            using var updateService = new UserRoleUpdateService(cancellationToken);
            var user = await updateService.ChangeRoleAsync(User.GetUserId(), model.UserId, model.RoleId);
            return mapper.Map<UserInfoModel>(user);
        }

        // Soft-delete (B4, 2026-08-06). Нельзя удалить самого себя — см. UserDeletionService.
        [HttpDelete]
        [Route("Delete")]
        public async Task DeleteUserAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var deletionService = new UserDeletionService(cancellationToken);
            await deletionService.DeleteAsync(id, User.GetUserId());
        }

        // Ставит ForceToChangePass=true и возвращает обновлённого юзера (B5, 2026-08-06) —
        // фронту не нужен второй GET.
        [HttpPost]
        [Route("ForcePasswordReset")]
        public async Task<UserInfoModel> ForcePasswordResetAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var resetService = new UserForcePasswordResetService(cancellationToken);
            var user = await resetService.ForceResetAsync(id);
            return mapper.Map<UserInfoModel>(user);
        }
    }
}
