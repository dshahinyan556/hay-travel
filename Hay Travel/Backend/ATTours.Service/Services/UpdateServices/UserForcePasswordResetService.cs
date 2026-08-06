using ArmeniaTours.DataLayer;
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

        public async Task<User> ForceResetAsync(int id)
        {
            var user = await EntityRepository.AsQueryable()
                                             .Include(x => x.Role)
                                             .SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"User with id {id} not found.");

            user.ForceToChangePass = true;
            await EntityRepository.SaveChangesAsync(cancellationToken);

            return user;
        }
    }
}
