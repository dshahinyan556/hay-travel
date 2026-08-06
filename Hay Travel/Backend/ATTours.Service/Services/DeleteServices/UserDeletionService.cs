using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.DeleteServices
{
    // Soft-delete пользователя (B4, 2026-08-06): не удаляет строку, только помечает
    // IsDeleted=true и отзывает все живые сессии — см. AuthService.LoginAsync/RefreshAsync,
    // которые дополнительно проверяют IsDeleted (иначе ещё не истёкший access/refresh токен
    // удалённого пользователя продолжал бы работать).
    public class UserDeletionService : RepositoryCoreBase<User, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public UserDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        private IEntityRepository<RefreshToken>? refreshTokenRepository;
        private IEntityRepository<RefreshToken> RefreshTokenRepository => refreshTokenRepository ??= new EntityRepository<RefreshToken>(Context);

        public async Task DeleteAsync(int id, int actingUserId)
        {
            // Where(!IsDeleted) вместо простого SingleOrDefaultAsync(Id==id) — уже удалённый
            // пользователь отвечает тем же 404, что и несуществующий (идемпотентно).
            // Include(Role) нужен для GuardAdminAccount ниже.
            var user = await EntityRepository.AsQueryable()
                                             .Include(x => x.Role)
                                             .SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"User with id {id} not found.");

            if (id == actingUserId)
                throw new ErrorModelException(GlobalErrorCode.CannotDeleteSelf, HttpStatusCode.BadRequest,
                    "You cannot delete your own account.");

            GuardAdminAccount(user);

            user.IsDeleted = true;

            // Локальная копия AuthService.RevokeAllRefreshTokensAsync (3 строки) — не тащить
            // общий helper ради одного второго вызывающего (см. чек-лист B4).
            var activeTokens = await RefreshTokenRepository.AsQueryable()
                                                           .Where(x => x.UserId == id && x.RevokedAtUtc == null)
                                                           .ToListAsync(cancellationToken);
            var revokedAtUtc = DateTime.UtcNow;
            foreach (var activeToken in activeTokens)
                activeToken.RevokedAtUtc = revokedAtUtc;

            await EntityRepository.SaveChangesAsync(cancellationToken);
        }

        // Симметрично GuardAdminDemotion в UserRoleUpdateService (B6): смена роли Admin
        // безусловно запрещена кем угодно, но до этой правки удаление аккаунта того же Admin
        // такой защиты не имело — soft-delete обходил guard, которого сама роль обойти не могла.
        // actingUserId уже проверен отдельно (self-delete, строка выше) — здесь остаётся только
        // цель.
        private static void GuardAdminAccount(User user)
        {
            if (user.Role.Type != RoleType.Admin)
                return;

            throw new ErrorModelException(GlobalErrorCode.AdminAccountImmutable, HttpStatusCode.Forbidden,
                "An Admin account can only be deleted directly in the database.");
        }
    }
}
