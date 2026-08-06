using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services
{
    // Пишет LastActiveAtUtc/LastLoginIp на каждый авторизованный запрос (B7, 2026-08-06),
    // вызывается из UserActivityTrackingMiddleware. Bulk ExecuteUpdateAsync — без загрузки
    // и трекинга полной сущности, дешевле, чем SingleOrDefault+SaveChanges на каждый запрос.
    public class UserActivityTrackingService : RepositoryCoreBase<User, ATToursContextFactory>
    {
        // "Онлайн сейчас" может отставать до 5 минут на активном пользователе — приемлемо
        // для approximate-индикатора (компромисс архитектора, зафиксирован в чек-листе B7).
        private static readonly TimeSpan ThrottleWindow = TimeSpan.FromMinutes(5);

        public UserActivityTrackingService()
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
        }

        public async Task TrackAsync(int userId, string ip, CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            var staleBefore = now - ThrottleWindow;

            await Context.Set<User>()
                        .Where(u => u.Id == userId && !u.IsDeleted &&
                                    (u.LastActiveAtUtc == null || u.LastActiveAtUtc < staleBefore))
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(u => u.LastActiveAtUtc, now)
                            .SetProperty(u => u.LastLoginIp, ip), cancellationToken);
        }
    }
}
