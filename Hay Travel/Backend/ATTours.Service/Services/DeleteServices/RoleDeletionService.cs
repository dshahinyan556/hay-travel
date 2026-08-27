using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.DeleteServices
{
    // Удаление роли. Единственный запрет — роль с не-удалёнными пользователями не удаляется
    // (RoleInUse, 409): молчаливый перенос людей на другую роль был бы незаметной массовой
    // потерей доступа. Сидовые 4 роли ничем не защищены — их можно удалить точно так же,
    // как кастомную, если на них никто не назначен (решение Давида 2026-08-22).
    // Строки RolePermission уносит каскад (UserRoleConfiguration).
    public class RoleDeletionService : RepositoryCoreBase<UserRole, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public RoleDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id)
        {
            var role = await EntityRepository.AsQueryable()
                                             .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RoleNotFound, HttpStatusCode.NotFound,
                           $"Role with id {id} not found.");

            var userRepository = new EntityRepository<User>(Context);

            var inUse = await userRepository.AsQueryable()
                                            .AnyAsync(user => user.RoleId == id && !user.IsDeleted, cancellationToken);
            if (inUse)
                throw new ErrorModelException(GlobalErrorCode.RoleInUse, HttpStatusCode.Conflict,
                    $"Role with id {id} is assigned to one or more users and cannot be deleted. Reassign them first.");

            // Soft-deleted пользователь строку в User не удаляет, а FK UserRole <- User стоит
            // на Restrict: без этой проверки БД отбила бы удаление сырой ошибкой вместо 409.
            var heldBySoftDeleted = await userRepository.AsQueryable()
                                                        .AnyAsync(user => user.RoleId == id, cancellationToken);
            if (heldBySoftDeleted)
                throw new ErrorModelException(GlobalErrorCode.RoleInUse, HttpStatusCode.Conflict,
                    $"Role with id {id} is still referenced by deleted user accounts and cannot be removed.");

            EntityRepository.Delete(role);
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
