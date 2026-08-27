using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Рабочая специализация сотрудника по умолчанию (Задача D). Точечная операция по образцу
    // UserPhoneUpdateService: грузит одну строку и меняет одно скалярное поле.
    //
    // Ролевых guard'ов внутри нет: доступ ограничен UsersController ([Authorize(Roles=Admin)]).
    // RoleType.Employee тоже не проверяется — дефолт можно проставить заранее, до выдачи
    // роли Employee, и это ничего не ломает: настоящий гейт стоит на самом назначении.
    public class UserJobRoleUpdateService : RepositoryCoreBase<User, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public UserJobRoleUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // null — валидное значение: «снять роль по умолчанию».
        public async Task<User> UpdateJobRoleAsync(int userId, EmployeeJobRole? jobRole)
        {
            if (jobRole is not null && !Enum.IsDefined(jobRole.Value))
                throw new ErrorModelException(GlobalErrorCode.EmployeeRoleRequired, HttpStatusCode.BadRequest,
                    $"Employee role '{(int)jobRole.Value}' is not a valid job role.");

            // Include(Role) — контроллер отдаёт UserInfoModel, а его маппинг читает Role.Type.
            // !IsDeleted: удалённый пользователь отвечает 404, как и несуществующий.
            var user = await EntityRepository.AsQueryable()
                                             .Include(x => x.Role)
                                             .SingleOrDefaultAsync(x => x.Id == userId && !x.IsDeleted, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"User with id {userId} not found.");

            user.DefaultJobRole = jobRole;
            await EntityRepository.SaveChangesAsync(cancellationToken);

            return user;
        }
    }
}
