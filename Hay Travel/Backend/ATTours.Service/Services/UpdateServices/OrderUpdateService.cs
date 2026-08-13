using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Правка даты/числа гостей уже созданной брони. Разрешена только пока заказ
    // PendingConfirmation — после Confirmed/Cancelled изменение съезжало бы мимо занятости
    // календаря и подтверждения администратора (см. решение по флоу заказов, B12).
    //
    // Апдейта раньше не было вообще: "редактирование" на фронте било в Create и плодило
    // дубликаты заказов — этот сервис закрывает именно этот пробел.
    public class OrderUpdateService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task<Order> UpdateAsync(int id, DateOnly tourDate, int guestCount)
        {
            var order = await EntityRepository.AsQueryable()
                                              .Include(x => x.Payment)
                                              .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {id} not found.");

            if (order.Status != OrderStatus.PendingConfirmation)
                throw new ErrorModelException(GlobalErrorCode.OrderNotEditable, HttpStatusCode.BadRequest,
                    $"Order with id {id} can no longer be edited (status: {order.Status}).");

            order.TourDate = tourDate;
            order.GuestCount = guestCount;

            await new OrderValidationService([order], Context).ValidateEntitiesAsync();

            // Пересчёт от того же снапшота цены: правка гостей не должна переоценивать тур
            // по текущей цене (снапшот фиксируется один раз, на создании, ADR 014).
            if (order.Payment is not null)
                order.Payment.TotalAmount = order.Payment.TourPriceSnapshot * order.GuestCount;

            await EntityRepository.SaveChangesAsync(cancellationToken);
            return order;
        }
    }
}
