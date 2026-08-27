using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение персональных override пользователя для блока «права поверх роли» на карточке
    // пользователя (GET api/Users/{id}/PermissionOverrides). Отдаёт только реально
    // заведённые строки — экраны без override фронт добирает из его роли.
    public class UserPermissionOverrideInfo : EntityInfoBase<UserPermissionOverride>
    {
        public UserPermissionOverrideInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public UserPermissionOverrideInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public UserPermissionOverrideInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        public async Task<List<UserPermissionOverride>> GetForUserAsync(int userId)
            => await GetAllAsync(permissionOverride => permissionOverride.UserId == userId);
    }
}
