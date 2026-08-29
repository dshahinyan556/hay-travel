using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Authorization;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Язык писем пользователя (редизайн 2026-08-23). Точечная операция по образцу
    // UserJobRoleUpdateService: грузит одну строку и меняет одно скалярное поле.
    //
    // Ролевых guard'ов внутри нет, кроме SuperAdminGuard: доступ ограничен UsersController.
    public class UserPreferredLanguageUpdateService : RepositoryCoreBase<User, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public UserPreferredLanguageUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // actingUserId (2026-08-27) — только ради SuperAdminGuard: остальная логика от того,
        // кто выполняет операцию, не зависит.
        public async Task<User> UpdateLanguageAsync(int userId, LanguageCode language, int actingUserId)
        {
            // Значение вне диапазона enum ошибкой НЕ отбивается: язык — не бизнес-инвариант
            // (в отличие от роли исполнителя, где 400 защищает от назначения без роли),
            // у него есть безопасный дефолт, и заводить ради него GlobalErrorCode значит
            // плодить код, который никогда не долетит до фронта.
            //
            // Warning'а здесь нет: у сервисов, создаваемых через `new`, логгера в этом
            // проекте не бывает (см. OrderEventLog), а тянуть DI ради одной строки — хуже,
            // чем не иметь её: значение всё равно нормализуется, а не теряется молча.
            if (!Enum.IsDefined(language))
                language = LanguageCode.Russian;

            // Include(Role) — контроллер отдаёт UserInfoModel, а его маппинг читает Role.Type.
            // !IsDeleted: удалённый пользователь отвечает 404, как и несуществующий.
            var user = await EntityRepository.AsQueryable()
                                             .Include(x => x.Role)
                                             .SingleOrDefaultAsync(x => x.Id == userId && !x.IsDeleted, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"User with id {userId} not found.");

            SuperAdminGuard.GuardSuperAdminTarget(user, actingUserId);

            user.PreferredLanguage = language;
            await EntityRepository.SaveChangesAsync(cancellationToken);

            return user;
        }
    }
}
