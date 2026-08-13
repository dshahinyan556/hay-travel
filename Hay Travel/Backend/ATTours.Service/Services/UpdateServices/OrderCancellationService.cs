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
    // Точечная отмена брони: грузит единственную строку без графа и меняет только статус
    // (по образцу TourActivationService). Заказ не удаляется — отменённый остаётся в
    // истории, но выпадает из занятости календаря (Status != Cancelled).
    //
    // Проверку «свой/чужой заказ» делает контроллер: у него есть и id из токена, и роль.
    public class OrderCancellationService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderCancellationService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task CancelAsync(int id)
        {
            var order = await EntityRepository.AsQueryable()
                                              .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {id} not found.");

            order.Status = OrderStatus.Cancelled;
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
