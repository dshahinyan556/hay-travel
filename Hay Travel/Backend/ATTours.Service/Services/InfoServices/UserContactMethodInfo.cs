using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение справочника способов связи в профиле (батч 2026-08-29).
    //
    // Владелец ВСЕГДА в предикате — IDOR по этому сервису невозможен по конструкции: метода
    // «дай контакт по id» без userId здесь нет намеренно.
    public class UserContactMethodInfo : EntityInfoBase<UserContactMethod>
    {
        public UserContactMethodInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public UserContactMethodInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public UserContactMethodInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        // Справочник одного пользователя. Порядок: основной первым, дальше по Id —
        // сортирует сервер, чтобы фронт и письмо не расходились.
        public async Task<List<UserContactMethod>> GetByUserAsync(int userId, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository()
                         .Where(x => x.UserId == userId)
                         .OrderByDescending(x => x.IsPrimary)
                         .ThenBy(x => x.Id)
                         .ToListAsync(cancellationToken);
        }

        // userId в предикате обязателен: без него это был бы «дай любой контакт по id».
        public async Task<UserContactMethod> GetByIdAsync(int id, int userId, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository()
                         .SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        }
    }
}
