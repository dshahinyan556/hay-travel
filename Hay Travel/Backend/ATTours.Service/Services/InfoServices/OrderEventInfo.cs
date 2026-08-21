using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение журнала заказа под админский таб «История» (spec 007). Include не нужен: DTO
    // плоская, автор денормализован в самой строке (ADR 020 §3) — тот же приём, что в
    // LoginHistoryInfo, где пользователь тоже не подтягивается.
    public class OrderEventInfo : EntityInfoBase<OrderEvent>
    {
        public OrderEventInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public OrderEventInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public OrderEventInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        // Новые сверху. Лимита (Take) нет в отличие от LoginHistoryInfo: событий у одного
        // заказа десятки, не тысячи — журнал ограничен временем жизни самого заказа.
        // Id — вторичная сортировка: события одной мутации могут лечь в одну миллисекунду.
        public async Task<List<OrderEvent>> GetByOrderAsync(int orderId, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository()
                         .Where(x => x.OrderId == orderId)
                         .OrderByDescending(x => x.CreatedAtUtc)
                         .ThenByDescending(x => x.Id)
                         .ToListAsync(cancellationToken);
        }
    }
}
