using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Authorization;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Персональные права пользователя поверх его роли. Апсерт по (UserId, ScreenKey):
    // экран с Level = null — как и экран, которого нет во входящем наборе, — теряет строку
    // и снова наследует роль (architecture-flexible-roles.md §3.1, spec 014 §1.9).
    // Level = None это НЕ «наследовать»: это явный запрет доступа поверх роли.
    public class UserPermissionOverrideUpdateService : RepositoryCoreBase<UserPermissionOverride, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public UserPermissionOverrideUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        private IEntityRepository<User>? userRepository;
        private IEntityRepository<User> UserRepository => userRepository ??= new EntityRepository<User>(Context);

        public async Task<List<UserPermissionOverride>> SaveAsync(int userId, UserPermissionOverrideSaveModel model)
        {
            // Валидация ключей и применимости уровней — до любых записей.
            var incoming = RolePermissionMatrix.NormalizeOverrides(model?.Overrides);

            var userExists = await UserRepository.AsQueryable()
                                                 .AnyAsync(user => user.Id == userId && !user.IsDeleted, cancellationToken);
            if (!userExists)
                throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                    $"User with id {userId} not found.");

            var existing = await EntityRepository.AsQueryable()
                                                 .Where(permissionOverride => permissionOverride.UserId == userId)
                                                 .ToListAsync(cancellationToken);

            var handled = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var current in existing)
            {
                var screenKey = current.ScreenKey;

                // Экрана нет во входящем наборе (или его Level = null) — строка не нужна,
                // пользователь снова наследует роль по этому экрану.
                if (screenKey is null
                    || !incoming.TryGetValue(screenKey, out var desired)
                    || desired is null)
                {
                    EntityRepository.Delete(current);
                    continue;
                }

                current.Level = desired;
                handled.Add(screenKey);
            }

            foreach (var (screenKey, level) in incoming)
            {
                if (handled.Contains(screenKey) || level is null)
                    continue;

                await EntityRepository.AddAsync(new UserPermissionOverride
                {
                    UserId = userId,
                    ScreenKey = screenKey,
                    Level = level
                }, cancellationToken);
            }

            await EntityRepository.SaveChangesAsync(cancellationToken);

            return await EntityRepository.AsQueryable()
                                         .AsNoTracking()
                                         .Where(permissionOverride => permissionOverride.UserId == userId)
                                         .ToListAsync(cancellationToken);
        }
    }
}
