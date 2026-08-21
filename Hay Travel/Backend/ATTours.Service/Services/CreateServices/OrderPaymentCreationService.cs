using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Shared;
using ATTours.Common.DTO.Init;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.CreateServices
{
    // Ручная проводка по строке заказа (нет платёжного шлюза — админ фиксирует факт оплаты
    // сам, ADR 019 §"Что сознательно НЕ делаем сейчас").
    public class OrderPaymentCreationService : RepositoryCoreBase<OrderLine, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderPaymentCreationService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task<OrderPayment> AddAsync(OrderPaymentCreateModel model)
        {
            var lineExists = await EntityRepository.AsQueryable().AnyAsync(x => x.Id == model.OrderLineId, cancellationToken);
            if (!lineExists)
                throw new ErrorModelException(GlobalErrorCode.OrderLineNotFound, HttpStatusCode.NotFound,
                    $"Order line with id {model.OrderLineId} not found.");

            var payment = new OrderPayment
            {
                OrderLineId = model.OrderLineId,
                Type = model.Type,
                Amount = model.Amount,
                CreatedAtUtc = DateTime.UtcNow,
                Number = await OrderPaymentNumberGenerator.GenerateAsync(Context, cancellationToken)
            };

            Context.Set<OrderPayment>().Add(payment);
            await Context.SaveChangesAsync(cancellationToken);
            return payment;
        }
    }
}
