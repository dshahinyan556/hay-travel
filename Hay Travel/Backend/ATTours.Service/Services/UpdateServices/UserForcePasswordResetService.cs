using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Authorization;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Ставит ForceToChangePass=true (B5, 2026-08-06). Слишком мелкая/несвязанная операция,
    // чтобы тащить в UserRoleUpdateService.
    //
    // ПРОБЕЛ (зафиксирован архитектором, не закрывается этим сервисом): ForceToChangePass
    // сейчас только читается и кладётся в LoginResultModel.ForceChangePassword — ничто на
    // бэкенде не блокирует дальнейшие запросы, пока флаг true. Реальный enforcement (403 на
    // все не-auth эндпоинты) — отдельное решение, требующее отдельного подтверждения Давида.
    public class UserForcePasswordResetService : RepositoryCoreBase<User, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public UserForcePasswordResetService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // actingUserId добавлен 2026-08-27: до этого операция была единственной админской
        // записью по чужой учётке вообще без guard'ов — форс-сброс пароля пролезал и по
        // SuperAdmin'у, и по любому админскому аккаунту.
        public async Task<User> ForceResetAsync(int id, int actingUserId)
        {
            // Include(Role) нужен и маппингу UserInfoModel (Role.Type), и GuardAdminAccount ниже.
            var user = await EntityRepository.AsQueryable()
                                             .Include(x => x.Role)
                                             .SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"User with id {id} not found.");

            await GuardAdminAccountAsync(user, actingUserId);

            user.ForceToChangePass = true;
            await EntityRepository.SaveChangesAsync(cancellationToken);

            return user;
        }

        // Копия guard'а из UserDeletionService: форс-сброс пароля по последствиям равен
        // захвату учётки (владелец обязан сменить пароль на следующем входе), поэтому и
        // защищён теми же двумя тирами — сначала безусловная неприкосновенность SuperAdmin'а,
        // затем «админские аккаунты трогает только SuperAdmin».
        //
        // Себе форс-сброс не запрещён (в отличие от self-delete): аккаунт остаётся у
        // владельца, ничего необратимого не происходит.
        private async Task GuardAdminAccountAsync(User target, int actingUserId)
        {
            SuperAdminGuard.GuardSuperAdminTarget(target, actingUserId);

            if (!target.Role.CanManageAdmins)
                return;

            // Действующий пользователь читается из БД, а не из claim'а токена: claim решает
            // только, что показать в UI.
            var actingUser = await EntityRepository.AsQueryable()
                                                   .SingleOrDefaultAsync(x => x.Id == actingUserId && !x.IsDeleted, cancellationToken);

            if (actingUser is null || !actingUser.IsSuperAdmin)
                throw new ErrorModelException(GlobalErrorCode.SuperAdminPrivilegeRequired, HttpStatusCode.Forbidden,
                    "Only a super administrator can force a password reset on an administrator account.");
        }
    }
}
