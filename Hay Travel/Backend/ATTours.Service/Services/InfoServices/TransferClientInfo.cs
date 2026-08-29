using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using System.Linq.Expressions;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Публичная read-модель предопределённого трансфера (батч 2026-08-29). Отделена от
    // TourClientInfo по той же причине, по которой та отделена от админской TourInfo (D-7):
    // это другой набор данных — маршрут и цены по классам авто вместо дней, регионов и тегов.
    // Фильтр по типу продукта живёт здесь, а не в контроллере: трансфер публично виден
    // только на /transfers (решение 0.15), и ни один вызов этой read-модели не должен уметь
    // случайно отдать тур.
    public class TransferClientInfo : EntityInfoBase<Tour>
    {
        public TransferClientInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public TransferClientInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public TransferClientInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        // Список карточек: только опубликованные и неархивные трансферы. AsSplitQuery — тот же
        // приём, что на остальных публичных путях: маршрут и цены это две sibling-коллекции
        // с одного корня, помноженные ещё и на число трансферов в списке.
        public async Task<List<Tour>> GetCardsAsync(CancellationToken cancellationToken = default)
        {
            Expression<Func<Tour, bool>> where = x => x.Type == Common.Enums.TourType.Transfer && x.IsActive && !x.IsArchived;

            return await GetEntityQueryableRepository()
                .IncludeTransferCardGraph()
                .AsSplitQuery()
                .Where(where)
                .ToListAsync(cancellationToken);
        }

        // Детальная: граф с развёрнутым классом авто. Черновик/архив и «это вообще не
        // трансфер» отсекает контроллер (404), как и в TourClientInfo.GetClientDetailAsync.
        public async Task<Tour> GetDetailAsync(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository()
                .IncludeTransferDetailGraph()
                .AsSplitQuery()
                .SingleOrDefaultAsync(x => x.Id == id && x.Type == Common.Enums.TourType.Transfer, cancellationToken);
        }
    }
}
