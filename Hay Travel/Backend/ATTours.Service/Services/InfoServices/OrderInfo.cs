using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using System.Linq.Expressions;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение заказов: и «мои заказы», и админский список — граф один и тот же (ADR 019).
    // Include(Lines) обязателен — тур/дата/деньги/исполнитель/платежи живут на строках, не на
    // заказе. User нужен под денормализованные поля OrderInfoModel (email/имя).
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

        // Lines/Translations объявлены HashSet<>, поэтому каждый корневой Include(...Lines)
        // приводится к ICollection<> — иначе выбирается identity-перегрузка ThenInclude
        // (тот же приём, что в TourGraphQueryExtensions).
        protected override IEntityQueryableRepository<Order> GetEntityQueryableRepository()
        {
            return base.GetEntityQueryableRepository()
                       .Include(x => x.User)
                       .Include((Expression<Func<Order, ICollection<OrderLine>>>)(x => x.Lines))
                           .ThenInclude(line => line.Tour)
                               .ThenInclude((Expression<Func<Tour, ICollection<TourInfoTranslation>>>)(tour => tour.Translations))
                       .Include((Expression<Func<Order, ICollection<OrderLine>>>)(x => x.Lines))
                           .ThenInclude(line => line.Employee)
                       .Include((Expression<Func<Order, ICollection<OrderLine>>>)(x => x.Lines))
                           .ThenInclude(line => line.Payments)
                       // Lines->Payments — коллекция внутри коллекции, тот же cartesian-explosion
                       // риск, что у Tour (см. tech-debt.md, TourInfo/TourClientInfo 2026-08-16).
                       .AsSplitQuery();
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

        // «Мои заказы, где я назначен исполнителем» — Employee, read-only (Фаза 2).
        public async Task<List<Order>> GetByEmployeeAsync(int employeeId, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository()
                         .Where(order => order.Lines.Any(line => line.EmployeeId == employeeId))
                         .ToListAsync(cancellationToken);
        }
    }
}
