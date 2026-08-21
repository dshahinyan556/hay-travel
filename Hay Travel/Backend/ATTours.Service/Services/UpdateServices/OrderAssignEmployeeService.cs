using ArmeniaTours.DataLayer;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Назначение исполнителя. LineId == null — "назначить на все строки" (Давид, 2026-08-16):
    // применяется ко всем строкам заказа разом, каждую потом можно переопределить отдельным
    // вызовом с заданным LineId.
    public class OrderAssignEmployeeService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderAssignEmployeeService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // Возвращает адрес/имя назначенного сотрудника и id затронутых строк — контроллер
        // использует их для письма "Назначить и отправить" (Фаза 5.2), не перезапрашивая
        // сотрудника отдельно.
        public async Task<OrderAssignEmployeeResult> AssignAsync(OrderAssignEmployeeModel model)
        {
            var employee = await Context.Set<User>()
                                        .Include(x => x.Role)
                                        .Where(x => x.Id == model.EmployeeId && x.Role.Type == RoleType.Employee)
                                        .Select(x => new { x.Email, x.FirstName, x.LastName })
                                        .SingleOrDefaultAsync(cancellationToken)
                           ?? throw new ErrorModelException(GlobalErrorCode.UserIsNotEmployee, HttpStatusCode.BadRequest,
                               $"User with id {model.EmployeeId} is not an employee.");

            var order = await EntityRepository.AsQueryable()
                                              .Include(x => x.Lines)
                                              .SingleOrDefaultAsync(x => x.Id == model.OrderId, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {model.OrderId} not found.");

            var targets = model.LineId is null
                ? order.Lines.ToList()
                : order.Lines.Where(line => line.Id == model.LineId).ToList();

            if (model.LineId is not null && targets.Count == 0)
                throw new ErrorModelException(GlobalErrorCode.OrderLineNotFound, HttpStatusCode.NotFound,
                    $"Order line with id {model.LineId} not found in order {model.OrderId}.");

            foreach (var line in targets)
                line.EmployeeId = model.EmployeeId;

            await EntityRepository.SaveChangesAsync(cancellationToken);

            return new OrderAssignEmployeeResult
            {
                AssignedLineIds = targets.Select(line => line.Id).ToList(),
                EmployeeEmail = employee.Email,
                EmployeeFullName = $"{employee.FirstName} {employee.LastName}".Trim()
            };
        }
    }

    public class OrderAssignEmployeeResult
    {
        public List<int> AssignedLineIds { get; set; } = [];
        public string EmployeeEmail { get; set; }
        public string EmployeeFullName { get; set; }
    }
}
