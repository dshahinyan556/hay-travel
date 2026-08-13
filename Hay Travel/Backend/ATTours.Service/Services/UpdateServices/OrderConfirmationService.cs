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
    // Ручное подтверждение брони (по образцу OrderCancellationService): грузит единственную
    // строку без графа и меняет только статус. Заказы теперь создаются как
    // PendingConfirmation (B12) — это единственный путь в Confirmed.
    public class OrderConfirmationService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderConfirmationService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task ConfirmAsync(int id)
        {
            var order = await EntityRepository.AsQueryable()
                                              .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {id} not found.");

            if (order.Status != OrderStatus.PendingConfirmation)
                throw new ErrorModelException(GlobalErrorCode.OrderNotEditable, HttpStatusCode.BadRequest,
                    $"Order with id {id} is not pending confirmation (status: {order.Status}).");

            order.Status = OrderStatus.Confirmed;
            order.ConfirmedAtUtc = DateTime.UtcNow;
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
