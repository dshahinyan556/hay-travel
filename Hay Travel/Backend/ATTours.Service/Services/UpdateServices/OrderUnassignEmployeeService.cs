using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Notifications;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Linq.Expressions;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Снятие исполнителя (Задача D). Отдельный сервис, а не Assign с nullable-полями:
    // у назначения роль обязательна, и размывать этот инвариант ради обратной операции
    // нельзя. Bulk-семантика та же: LineId == null — снять со всех строк заказа.
    //
    // EmployeeId == null снимает ВСЕХ исполнителей целевых строк (действие «снять
    // исполнителя» со строки целиком), заданный — только этого человека.
    public class OrderUnassignEmployeeService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderUnassignEmployeeService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // Возвращает СНЯТЫХ сотрудников (данные захвачены до удаления) — контроллеру
        // они нужны для письма, а перезапросить их после снятия уже нельзя.
        public async Task<OrderUnassignEmployeeResult> UnassignAsync(OrderUnassignEmployeeModel model)
        {
            // Lines объявлена HashSet<>, поэтому корневой Include приводится к ICollection<> —
            // иначе выбирается identity-перегрузка и ThenInclude уходит не в OrderLine
            // (тот же приём, что в OrderInfo/TourGraphQueryExtensions).
            var order = await EntityRepository.AsQueryable()
                                              .Include((Expression<Func<Order, ICollection<OrderLine>>>)(x => x.Lines))
                                                  .ThenInclude((Expression<Func<OrderLine, ICollection<OrderLineEmployee>>>)(line => line.Employees))
                                                      .ThenInclude(assignment => assignment.Employee)
                                              .SingleOrDefaultAsync(x => x.Id == model.OrderId, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {model.OrderId} not found.");

            var targets = model.LineId is null
                ? order.Lines.ToList()
                : order.Lines.Where(line => line.Id == model.LineId).ToList();

            if (model.LineId is not null && targets.Count == 0)
                throw new ErrorModelException(GlobalErrorCode.OrderLineNotFound, HttpStatusCode.NotFound,
                    $"Order line with id {model.LineId} not found in order {model.OrderId}.");

            // Снятие уже-снятого идемпотентно: назначений на строке просто нет,
            // и это не ошибка — иначе bulk-снятие падало бы на смешанном заказе.
            var assignments = targets
                .SelectMany(line => line.Employees)
                .Where(assignment => model.EmployeeId is null || assignment.EmployeeId == model.EmployeeId)
                .ToList();

            var result = new OrderUnassignEmployeeResult
            {
                UnassignedLineIds = [.. assignments.Select(assignment => assignment.OrderLineId).Distinct()],
                Unassigned = BuildUnassignedEmployees(assignments)
            };

            Context.Set<OrderLineEmployee>().RemoveRange(assignments);

            await EntityRepository.SaveChangesAsync(cancellationToken);

            return result;
        }

        // Bulk мог задеть строки разных исполнителей, поэтому письмо шлётся по УНИКАЛЬНЫМ
        // снятым сотрудникам, а не одному «главному».
        private static List<OrderEmployeeRecipient> BuildUnassignedEmployees(List<OrderLineEmployee> assignments)
        {
            return [.. assignments
                .Where(assignment => assignment.Employee is not null)
                .GroupBy(assignment => assignment.EmployeeId)
                .Select(group => new OrderEmployeeRecipient
                {
                    EmployeeId = group.Key,
                    Email = group.First().Employee.Email,
                    FullName = $"{group.First().Employee.FirstName} {group.First().Employee.LastName}".Trim(),
                    // Роль берётся с первой строки группы: один сотрудник на одном заказе
                    // назначается одной ролью (попап назначения выбирает её один раз).
                    EmployeeRole = group.First().EmployeeRole,
                    PreferredLanguage = group.First().Employee.PreferredLanguage,
                    LineIds = [.. group.Select(assignment => assignment.OrderLineId)]
                })];
        }
    }

    public class OrderUnassignEmployeeResult
    {
        public List<int> UnassignedLineIds { get; set; } = [];

        // Пустой список — снимать было нечего (идемпотентный повтор), это не ошибка.
        public List<OrderEmployeeRecipient> Unassigned { get; set; } = [];
    }
}
