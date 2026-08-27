using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
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

            // Первым и безусловно, в том числе для SuperAdmin (D4): удалить себя нельзя
            // никому, независимо от привилегий.
            if (id == actingUserId)
                throw new ErrorModelException(GlobalErrorCode.CannotDeleteSelf, HttpStatusCode.BadRequest,
                    "You cannot delete your own account.");

            await GuardAdminAccountAsync(user, actingUserId);

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

        // Симметрично GuardRoleChange в UserRoleUpdateService: удаление аккаунта, чья роль
        // держит CanManageAdmins, доступно только SuperAdmin'у. Self-delete проверен
        // отдельно и раньше (строка выше). Обновлено 2026-08-22: не привязано к конкретному
        // RoleType — CanManageAdmins может стоять у любой (в т.ч. кастомной) роли.
        //
        // Действующий пользователь читается из БД, а не из claim'а токена: claim решает
        // только, что показать в UI, прямой запрос в обход интерфейса должен отбиваться
        // фактическим состоянием строки.
        private async Task GuardAdminAccountAsync(User target, int actingUserId)
        {
            // Удаление аккаунта без этого флага привилегий не требует — лишний запрос в БД
            // не нужен.
            if (!target.Role.CanManageAdmins)
                return;

            var actingUser = await EntityRepository.AsQueryable()
                                                   .SingleOrDefaultAsync(x => x.Id == actingUserId && !x.IsDeleted, cancellationToken);

            if (actingUser is null || !actingUser.IsSuperAdmin)
                throw new ErrorModelException(GlobalErrorCode.SuperAdminPrivilegeRequired, HttpStatusCode.Forbidden,
                    "Only a super administrator can delete an administrator account.");
        }
    }
}
