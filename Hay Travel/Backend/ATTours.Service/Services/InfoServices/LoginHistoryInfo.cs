using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение истории входов для админки (C2, 2026-08-09). Пользователь не включается:
    // список всегда запрашивается по известному userId, а LoginHistoryModel его не несёт.
    public class LoginHistoryInfo : EntityInfoBase<LoginHistory>
    {
        // Хвост истории конечен по умолчанию: у живого аккаунта строк накапливается сколько
        // угодно, а карточке пользователя нужны последние — не все.
        public const int DefaultTake = 100;

        public LoginHistoryInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public LoginHistoryInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public LoginHistoryInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        public async Task<List<LoginHistory>> GetForUserAsync(int userId, int take = DefaultTake, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository()
                         .Where(x => x.UserId == userId)
                         .OrderByDescending(x => x.LoggedInAtUtc)
                         .Take(take)
                         .ToListAsync(cancellationToken);
        }
    }
}
