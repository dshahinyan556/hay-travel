using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.DeleteServices
{
    // Удаление заказа целиком (Давид, 2026-08-16). Cascade на Order->Lines->Payments
    // (OrderLineConfiguration/OrderPaymentConfiguration) убирает строки и журнал проводок
    // одним вызовом — история платежей отдельно от заказа не хранится (см. ADR 019).
    public class OrderDeletionService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id)
        {
            var order = await EntityRepository.AsQueryable().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {id} not found.");

            Context.Set<Order>().Remove(order);
            await Context.SaveChangesAsync(cancellationToken);
        }
    }
}
