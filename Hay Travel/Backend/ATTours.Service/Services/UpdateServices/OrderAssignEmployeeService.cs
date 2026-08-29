using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Notifications;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Назначение исполнителей. LineId == null — "назначить на все строки" (Давид, 2026-08-16):
    // применяется ко всем строкам заказа разом, каждую потом можно переопределить отдельным
    // вызовом с заданным LineId.
    //
    // Семантика — АДДИТИВНЫЙ upsert (редизайн 2026-08-23): исполнители, не перечисленные
    // в запросе, не снимаются, а у уже назначенного обновляется только роль — детали
    // (pickup/навигатор/комментарий) правит отдельный эндпоинт и затирать их нельзя.
    public class OrderAssignEmployeeService : RepositoryCoreBase<Order, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public OrderAssignEmployeeService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // Возвращает адреса/имена/языки назначенных сотрудников и id затронутых строк —
        // контроллер использует их для письма "Назначить и отправить" и для журнала,
        // не перезапрашивая сотрудников отдельно.
        public async Task<OrderAssignEmployeeResult> AssignAsync(OrderAssignEmployeeModel model)
        {
            var items = model.Employees ?? [];

            // Назначение без единого исполнителя — не операция: тот же смысл, что и у
            // назначения без роли, поэтому и код ошибки тот же.
            if (items.Count == 0)
                throw new ErrorModelException(GlobalErrorCode.EmployeeRoleRequired, HttpStatusCode.BadRequest,
                    "At least one employee must be provided.");

            // Гейт «нельзя назначить без роли» (Задача D). EmployeeRole non-nullable, поэтому
            // отсутствие поля в запросе приезжает нулём — а 0 не входит в enum (значения
            // с 1), и IsDefined отбивает и его, и любое чужое число.
            foreach (var item in items)
                if (!Enum.IsDefined(item.EmployeeRole))
                    throw new ErrorModelException(GlobalErrorCode.EmployeeRoleRequired, HttpStatusCode.BadRequest,
                        $"Employee role '{(int)item.EmployeeRole}' is not a valid job role.");

            // Дубль сотрудника внутри одного запроса — неоднозначная роль: какую из двух
            // писать в снапшот, решить нечем.
            if (items.Select(item => item.EmployeeId).Distinct().Count() != items.Count)
                throw new ErrorModelException(GlobalErrorCode.EmployeeRoleRequired, HttpStatusCode.BadRequest,
                    "The same employee is listed more than once.");

            var employeeIds = items.Select(item => item.EmployeeId).ToList();

            // PreferredLanguage выбирается здесь же: письмо назначения персональное, и его
            // язык — язык исполнителя (второго похода в БД на отправке не нужно).
            var employees = await Context.Set<User>()
                                         .AsNoTracking()
                                         .Include(x => x.Role)
                                         .Where(x => employeeIds.Contains(x.Id) && x.Role.Type == RoleType.Employee)
                                         .Select(x => new { x.Id, x.Email, x.FirstName, x.LastName, x.PreferredLanguage, x.TelegramChatId })
                                         .ToListAsync(cancellationToken);

            var missing = employeeIds.Except(employees.Select(employee => employee.Id)).ToList();
            if (missing.Count > 0)
                throw new ErrorModelException(GlobalErrorCode.UserIsNotEmployee, HttpStatusCode.BadRequest,
                    $"User with id {missing[0]} is not an employee.");

            // Lines объявлена HashSet<>, поэтому корневой Include приводится к ICollection<> —
            // иначе выбирается identity-перегрузка и ThenInclude уходит не в OrderLine
            // (тот же приём, что в OrderInfo/TourGraphQueryExtensions).
            var order = await EntityRepository.AsQueryable()
                                              .Include((Expression<Func<Order, ICollection<OrderLine>>>)(x => x.Lines))
                                                  .ThenInclude(line => line.Employees)
                                              .SingleOrDefaultAsync(x => x.Id == model.OrderId, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {model.OrderId} not found.");

            var targets = model.LineId is null
                ? order.Lines.ToList()
                : order.Lines.Where(line => line.Id == model.LineId).ToList();

            if (model.LineId is not null && targets.Count == 0)
                throw new ErrorModelException(GlobalErrorCode.OrderLineNotFound, HttpStatusCode.NotFound,
                    $"Order line with id {model.LineId} not found in order {model.OrderId}.");

            var lineIdsByEmployee = new Dictionary<int, List<int>>();

            foreach (var line in targets)
            {
                foreach (var item in items)
                {
                    var assignment = line.Employees.FirstOrDefault(x => x.EmployeeId == item.EmployeeId);

                    if (assignment is null)
                    {
                        line.Employees.Add(new OrderLineEmployee
                        {
                            OrderLineId = line.Id,
                            EmployeeId = item.EmployeeId,
                            EmployeeRole = item.EmployeeRole
                        });
                    }
                    else
                    {
                        // Только роль: переназначение не должно стирать уже введённый pickup.
                        assignment.EmployeeRole = item.EmployeeRole;
                    }

                    if (!lineIdsByEmployee.TryGetValue(item.EmployeeId, out var lineIds))
                        lineIdsByEmployee[item.EmployeeId] = lineIds = [];

                    lineIds.Add(line.Id);
                }
            }

            await EntityRepository.SaveChangesAsync(cancellationToken);

            return new OrderAssignEmployeeResult
            {
                AffectedLineIds = targets.Select(line => line.Id).ToList(),
                Assigned = [.. items.Select(item =>
                {
                    var employee = employees.Single(x => x.Id == item.EmployeeId);

                    return new OrderEmployeeRecipient
                    {
                        EmployeeId = employee.Id,
                        Email = employee.Email,
                        FullName = $"{employee.FirstName} {employee.LastName}".Trim(),
                        EmployeeRole = item.EmployeeRole,
                        PreferredLanguage = employee.PreferredLanguage,
                        TelegramChatId = employee.TelegramChatId,
                        LineIds = lineIdsByEmployee.GetValueOrDefault(item.EmployeeId, [])
                    };
                })]
            };
        }
    }

    public class OrderAssignEmployeeResult
    {
        // Все затронутые строки — для журнала.
        public List<int> AffectedLineIds { get; set; } = [];

        // По одному элементу на сотрудника: письмо назначения персональное.
        public List<OrderEmployeeRecipient> Assigned { get; set; } = [];
    }
}
