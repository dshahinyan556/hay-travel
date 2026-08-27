using ArmeniaTours.DataLayer;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // "Детали для выполнения" одного исполнителя на одной строке (редизайн 2026-08-23):
    // раньше это были плоские поля OrderLine, теперь у водителя и гида на одной брони
    // своя карточка. Точечная правка скаляров по образцу OrderLineService.UpdateLineAsync.
    //
    // Роль здесь не правится — это делает Assign (upsert): иначе два эндпоинта писали бы
    // одно поле, и порядок их вызова начал бы иметь значение.
    public class OrderLineEmployeeUpdateService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderLineEmployeeUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // Возвращает контекст строки: OrderId для ответа/прав, OrderLineId — журналу
        // (OrderEventLog.LogLineUpdatedAsync адресуется строкой заказа, не заказом).
        public async Task<OrderLineEmployeeUpdateResult> UpdateAsync(OrderLineEmployeeUpdateModel model)
        {
            var assignment = await Context.Set<OrderLineEmployee>()
                                          .Include(x => x.OrderLine)
                                          .SingleOrDefaultAsync(x => x.Id == model.Id, cancellationToken)
                             ?? throw new ErrorModelException(GlobalErrorCode.OrderLineEmployeeNotFound,
                                 HttpStatusCode.NotFound,
                                 $"Order line employee assignment with id {model.Id} not found.");

            assignment.PickupDetails = model.PickupDetails;
            assignment.NavigatorLink = model.NavigatorLink;
            assignment.Comment = model.Comment;
            assignment.CommentEn = model.CommentEn;

            await Context.SaveChangesAsync(cancellationToken);

            return new OrderLineEmployeeUpdateResult
            {
                OrderId = assignment.OrderLine.OrderId,
                OrderLineId = assignment.OrderLineId
            };
        }
    }

    public class OrderLineEmployeeUpdateResult
    {
        public int OrderId { get; set; }
        public int OrderLineId { get; set; }
    }
}
