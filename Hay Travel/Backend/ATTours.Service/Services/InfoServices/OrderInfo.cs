using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using System.Linq.Expressions;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение заказов: и «мои заказы», и админский список — граф один и тот же.
    // Include(Payment) обязателен (деньги — отдельная сущность, ADR 014), User и переводы
    // тура нужны под денормализованные поля OrderInfoModel (email/имя/заголовок тура).
    public class OrderInfo : EntityInfoBase<Order>
    {
        public OrderInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public OrderInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public OrderInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        protected override IEntityQueryableRepository<Order> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository()
                       .Include(x => x.Payment)
                       .Include(x => x.User)
                       .Include(x => x.Tour)
                           // Translations объявлены HashSet<>, поэтому лямбда приводится к
                           // ICollection<> — иначе выбирается identity-перегрузка ThenInclude
                           // (тот же приём, что в TourGraphQueryExtensions).
                           .ThenInclude((Expression<Func<Tour, ICollection<TourInfoTranslation>>>)(tour => tour.Translations));
        }

        // «Мои заказы»: userId всегда приходит из токена, не из запроса.
        public async Task<List<Order>> GetByUserAsync(int userId, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository()
                         .Where(x => x.UserId == userId)
                         .ToListAsync(cancellationToken);
        }

        public async Task<Order> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }
    }
}
