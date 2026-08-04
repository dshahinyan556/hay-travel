using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Extensions;
using ATTours.Common.DTO.Auth;
using ATTours.Common.Settings;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

        [HttpPatch]
        [Route("ChangeRole")]
        public async Task<UserInfoModel> ChangeRoleAsync([FromBody] ChangeRoleModel model, CancellationToken cancellationToken)
        {
            using var updateService = new UserRoleUpdateService(cancellationToken);
            var user = await updateService.ChangeRoleAsync(model.UserId, model.RoleId, User.GetUserId());
            return mapper.Map<UserInfoModel>(user);
        }
    }
}
