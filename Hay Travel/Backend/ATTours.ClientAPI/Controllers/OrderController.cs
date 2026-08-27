using ATTours.BusinessServices.Notifications;
using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.Shared;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.ClientAPI.Extensions;
using ATTours.Common.Authorization;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Init;
using ATTours.Common.DTO.Request;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using ATTours.Common.Settings;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace ATTours.ClientAPI.Controllers
{
    // Заказы (spec 001, переделка ADR 019 2026-08-16 — мульти-строчные заказы). Стиль
    // контроллеров проекта: сервисы через new + using, в конструкторе только IMapper
    // (плюс IOrderNotificationService — он держит внедрённый singleton IEmailSender,
    // `new` для такого не годится, ADR 005).
    //
    // Все письма заказов идут через notification-сервис: тексты живут в шаблонах БД, и
    // решение «слать или нет» (тумблер IsEnabled) принимается там, а не здесь.
    //
    // Гостевой брони нет: создать заказ может любой аутентифицированный пользователь
    // (роль значения не имеет), поэтому [Authorize] без ролей на Create. Id владельца ВСЕГДА
    // берётся из токена (User.GetUserId()), никогда из тела запроса (IDOR).
    //
    // Админские методы гейтятся ключом "orders" целиком (решение 8 чек-листа: заказ +
    // строки + платежи + назначение — одно право, без дробления). Клиентские Create/Update/
    // GetMine и Employee-эндпоинт GetAssignedToMe в матрицу не входят (§2.5).
    [ApiController]
    [Route("api/[controller]")]
    public class OrderController(IMapper mapper, IOrderNotificationService notificationService) : Controller
    {
        // Чекаут корзины (ADR 025): тело — список позиций, результат — ОДИН заказ с N
        // строками, даже если позиция одна. Атомарность держит сам сервис (один агрегат,
        // один SaveChanges), поэтому здесь нет ни цикла по позициям, ни транзакции.
        //
        // try/catch тут сознательно нет: отказ валидации приезжает клиенту пер-строчным
        // OrderLinesErrorModel через цепочку обработчиков (ATToursExceptionMaster).
        [HttpPost]
        [Route("Create")]
        [Authorize]
        public async Task<OrderInfoModel> CreateAsync([FromBody] OrderCreateModel model, CancellationToken cancellationToken)
        {
            int orderId;
            using (var creationService = new OrderCreationService(model.Lines, User.GetUserId(), cancellationToken))
            {
                await creationService.ExecuteEntityChangesAsync();
                orderId = creationService.Entities.Single().Id;
            }

            // Перечитываем: ответ несёт денормализованные поля (пользователь, тур), которых
            // у только что собранной сущности нет.
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var result = mapper.Map<OrderInfoModel>(await info.GetByIdAsync(orderId, cancellationToken));

            // Флоу заказов (B12): каждая новая бронь ждёт подтверждения — админ должен об
            // этом узнать, а не наткнуться на неё сам в календаре. Провайдер письма не
            // бросает наружу (см. Brevo/SendGridEmailSender.PostAsync) — сбой уведомления
            // не должен ронять уже оформленную бронь. Выключенный тумблер шаблона
            // order.created тоже просто не даёт письму уйти (Задача E).
            await notificationService.SendOrderCreatedAsync(result, cancellationToken);

            await OrderEventLog.LogOrderCreatedAsync(orderId, User.GetUserId(), cancellationToken);

            return result;
        }

        // Деталь одного заказа для админского OrderDetailPage — только админ.
        [HttpGet]
        [Route("{id:int}")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.View)]
        public async Task<OrderInfoModel> GetByIdAsync(int id, CancellationToken cancellationToken)
        {
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var order = await info.GetByIdAsync(id, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {id} not found.");
            return mapper.Map<OrderInfoModel>(order);
        }

        // Правка своей брони (дата/гости), пока заказ ещё Open/PendingPayment. Тот же
        // владелец/админ доступ, что и у Delete — своя бронь или любая, если админ.
        [HttpPut]
        [Route("Update")]
        [Authorize]
        public async Task<OrderInfoModel> UpdateAsync([FromBody] OrderUpdateModel model, CancellationToken cancellationToken)
        {
            await EnsureOwnerOrAdminAsync(model.Id, cancellationToken);

            OrderUpdateResult update;
            using (var updateService = new OrderUpdateService(cancellationToken))
                update = await updateService.UpdateAsync(model.Id, model.TourDate, model.GuestCount);

            await OrderEventLog.LogOrderUpdatedAsync(model.Id, User.GetUserId(), update.PreviousTourDate,
                update.PreviousGuestCount, update.CurrentTourDate, update.CurrentGuestCount, cancellationToken);

            using var refreshedInfo = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return mapper.Map<OrderInfoModel>(await refreshedInfo.GetByIdAsync(model.Id, cancellationToken));
        }

        // Смена статуса — только админ (заменяет старые Confirm/Cancel, ADR 019).
        [HttpPatch]
        [Route("SetStatus")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.Update)]
        public async Task SetStatusAsync([FromBody] OrderStatusUpdateModel model, CancellationToken cancellationToken)
        {
            OrderStatusChangeResult change;
            using (var statusService = new OrderStatusService(cancellationToken))
                change = await statusService.SetStatusAsync(model.Id, model.Status, model.RejectReason);

            await OrderEventLog.LogStatusChangedAsync(model.Id, User.GetUserId(), change.PreviousStatus,
                change.CurrentStatus, change.RejectReason, cancellationToken);
        }

        // Добавить строку в существующий заказ — только админ.
        [HttpPost]
        [Route("AddLine")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.Create)]
        public async Task<OrderLineInfoModel> AddLineAsync([FromBody] OrderLineCreateModel model, CancellationToken cancellationToken)
        {
            OrderLineInfoModel line;
            using (var lineService = new OrderLineService(cancellationToken))
                line = mapper.Map<OrderLineInfoModel>(await lineService.AddLineAsync(model));

            await OrderEventLog.LogLineAddedAsync(line.Id, User.GetUserId(), cancellationToken);

            return line;
        }

        // Убрать строку — только админ. Последнюю оставшуюся строку убрать нельзя
        // (OrderMustHaveAtLeastOneLine) — для этого есть удаление заказа целиком.
        [HttpDelete]
        [Route("RemoveLine")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.Delete)]
        public async Task RemoveLineAsync([FromQuery] int lineId, CancellationToken cancellationToken)
        {
            OrderLineRemovedResult removed;
            using (var lineService = new OrderLineService(cancellationToken))
                removed = await lineService.RemoveLineAsync(lineId);

            await OrderEventLog.LogLineRemovedAsync(removed.OrderId, User.GetUserId(), removed.TourId,
                removed.TourDate, removed.GuestCount, cancellationToken);
        }

        // Правка строки: предоплата — только админ. "Детали для выполнения" переехали
        // на исполнителя (UpdateLineEmployee ниже).
        [HttpPut]
        [Route("UpdateLine")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.Update)]
        public async Task UpdateLineAsync([FromBody] OrderLineUpdateModel model, CancellationToken cancellationToken)
        {
            using (var lineService = new OrderLineService(cancellationToken))
                await lineService.UpdateLineAsync(model);

            await OrderEventLog.LogLineUpdatedAsync(model.Id, User.GetUserId(), cancellationToken);
        }

        // "Детали для выполнения" одного исполнителя на одной строке (редизайн 2026-08-23):
        // место встречи / навигатор / комментарий теперь у каждого свои. Роль здесь не
        // правится — её меняет AssignEmployee (upsert).
        //
        // Отдельного типа события журнала не заводим: для истории заказа это правка строки.
        [HttpPut]
        [Route("UpdateLineEmployee")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.Update)]
        public async Task UpdateLineEmployeeAsync([FromBody] OrderLineEmployeeUpdateModel model,
            CancellationToken cancellationToken)
        {
            OrderLineEmployeeUpdateResult updated;
            using (var updateService = new OrderLineEmployeeUpdateService(cancellationToken))
                updated = await updateService.UpdateAsync(model);

            await OrderEventLog.LogLineUpdatedAsync(updated.OrderLineId, User.GetUserId(), cancellationToken);
        }

        // "Назначить" / "Назначить и отправить" (Фаза 5.2) — на одну строку или на все
        // (model.LineId == null), теперь СРАЗУ НЕСКОЛЬКО исполнителей, у каждого своя роль
        // (редизайн 2026-08-23). Роль обязательна (Задача D) и уезжает снапшотом.
        //
        // Два независимых гейта письма (§E.8): model.SendEmail — намерение конкретного клика
        // (попап разводит «Назначить» и «Назначить и отправить»), рубильник канала события
        // order.assign_employee — глобальный, его проверяет notification-сервис. Он же решает,
        // кому письмо уходит, и сам собирает персональные PDF-вложения.
        // Сбой письма не должен откатывать уже сохранённое назначение (провайдер не бросает).
        [HttpPatch]
        [Route("AssignEmployee")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.Update)]
        public async Task AssignEmployeeAsync([FromBody] OrderAssignEmployeeModel model, CancellationToken cancellationToken)
        {
            OrderAssignEmployeeResult assignment;
            using (var assignService = new OrderAssignEmployeeService(cancellationToken))
                assignment = await assignService.AssignAsync(model);

            if (model.SendEmail)
            {
                using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
                var orderDto = mapper.Map<OrderInfoModel>(await info.GetByIdAsync(model.OrderId, cancellationToken));

                await notificationService.SendAssignmentAsync(orderDto, assignment.Assigned, cancellationToken);
            }

            // По одной записи журнала на сотрудника: «назначен X и Y» одной строкой читалось
            // бы хуже, а фильтровать историю по человеку стало бы нечем.
            foreach (var employee in assignment.Assigned)
                await OrderEventLog.LogEmployeeAssignedAsync(model.OrderId, User.GetUserId(), employee.FullName,
                    employee.LineIds, model.LineId is null, cancellationToken);
        }

        // Снятие исполнителя (Задача D) — на одну строку или на все (model.LineId == null),
        // та же bulk-семантика, что у назначения. model.EmployeeId задан — снимается только
        // он, null — все исполнители целевых строк. Снятие уже-снятого идемпотентно: письма
        // нет, событие в журнал не пишется.
        //
        // Персонального «тихого снятия» в UX нет: отправку решает только рубильник канала
        // события order.unassign_employee (§E.8), поэтому SendEmail в модели отсутствует.
        [HttpPatch]
        [Route("UnassignEmployee")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.Update)]
        public async Task UnassignEmployeeAsync([FromBody] OrderUnassignEmployeeModel model, CancellationToken cancellationToken)
        {
            OrderUnassignEmployeeResult unassignment;
            using (var unassignService = new OrderUnassignEmployeeService(cancellationToken))
                unassignment = await unassignService.UnassignAsync(model);

            if (unassignment.UnassignedLineIds.Count == 0)
                return;

            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var orderDto = mapper.Map<OrderInfoModel>(await info.GetByIdAsync(model.OrderId, cancellationToken));

            // Один вызов: сервис сам разошлёт персональные письма снятым и общие —
            // остальным настроенным получателям.
            await notificationService.SendUnassignmentAsync(orderDto, unassignment.Unassigned, cancellationToken);

            foreach (var employee in unassignment.Unassigned)
                await OrderEventLog.LogEmployeeUnassignedAsync(model.OrderId, User.GetUserId(), employee.FullName,
                    employee.LineIds, model.LineId is null, cancellationToken);
        }

        // "Отправить заказ" клиенту (Фаза 5.1). PDF собирает notification-сервис: вложение
        // зависит от того, кому уходит конкретное письмо (документ заказа клиенту ≠
        // персональное задание исполнителю, если админ добавил его в получатели).
        [HttpPost]
        [Route("SendToClient")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.Update)]
        public async Task SendToClientAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var order = await info.GetByIdAsync(id, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {id} not found.");
            var orderDto = mapper.Map<OrderInfoModel>(order);

            await notificationService.SendOrderDocumentAsync(orderDto, cancellationToken);

            await OrderEventLog.LogSentToClientAsync(id, User.GetUserId(), orderDto.UserEmail, cancellationToken);
        }

        // Ручная проводка (предоплата/оплата) по строке — только админ, нет платёжного шлюза.
        [HttpPost]
        [Route("AddPayment")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.Create)]
        public async Task<OrderPaymentInfoModel> AddPaymentAsync([FromBody] OrderPaymentCreateModel model, CancellationToken cancellationToken)
        {
            OrderPaymentInfoModel payment;
            using (var paymentService = new OrderPaymentCreationService(cancellationToken))
                payment = mapper.Map<OrderPaymentInfoModel>(await paymentService.AddAsync(model));

            await OrderEventLog.LogPaymentAddedAsync(payment.Id, User.GetUserId(), cancellationToken);

            return payment;
        }

        // Удалить заказ целиком — только админ. В журнал НЕ пишется сознательно (ADR 020 §5):
        // cascade сносит историю вместе с заказом, положить событие «удалён» некуда.
        [HttpDelete]
        [Route("Delete")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.Delete)]
        public async Task DeleteAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var deletionService = new OrderDeletionService(cancellationToken);
            await deletionService.DeleteAsync(id);
        }

        // Журнал заказа под таб «История» (spec 007) — только админ. Отдельный ленивый
        // запрос, а не поле в OrderInfoModel: тот граф переиспользуют публичные «Мои заказы»,
        // админский список, PDF и письма (ADR 020 §4). Существование заказа не проверяется:
        // у несуществующего история просто пустая, 404 здесь не нужен.
        [HttpGet]
        [Route("{id:int}/Events")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.View)]
        public async Task<List<OrderEventInfoModel>> GetEventsAsync(int id, CancellationToken cancellationToken)
        {
            using var info = new OrderEventInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return mapper.Map<List<OrderEventInfoModel>>(await info.GetByOrderAsync(id, cancellationToken));
        }

        // «Мои заказы»: список всегда по владельцу из токена, параметра userId нет
        // по конструкции. Заголовок тура отдаётся на запрошенном языке.
        [HttpGet]
        [Route("GetMine")]
        [Authorize]
        public async Task<List<OrderInfoModel>> GetMineAsync([FromQuery] int languageCode, CancellationToken cancellationToken)
        {
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var orders = await info.GetByUserAsync(User.GetUserId(), cancellationToken);

            foreach (var order in orders)
                foreach (var line in order.Lines)
                    line.Tour?.ExtractWithNeededLanguage(languageCode);

            return mapper.Map<List<OrderInfoModel>>(orders.OrderByDescending(order => order.CreatedAtUtc));
        }

        // Мои НАЗНАЧЕННЫЕ заказы — Employee, read-only (Фаза 2).
        [HttpGet]
        [Route("GetAssignedToMe")]
        [Authorize(Roles = ApiRoles.Employee)]
        public async Task<List<OrderInfoModel>> GetAssignedToMeAsync(CancellationToken cancellationToken)
        {
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var orders = await info.GetByEmployeeAsync(User.GetUserId(), cancellationToken);
            return mapper.Map<List<OrderInfoModel>>(orders.OrderByDescending(order => order.CreatedAtUtc));
        }

        // Админский список. Фильтры опциональны и складываются в один предикат (уезжает в SQL);
        // заголовок тура — русский (в админке язык не переключается). tourId/from/to теперь
        // фильтруют ПО СТРОКАМ (Any), заказ попадает в список, если хоть одна строка подходит.
        [HttpGet]
        [Route("GetAll")]
        [RequiresPermission(AdminScreens.Orders, PermissionAction.View)]
        public async Task<List<OrderInfoModel>> GetAllAsync([FromQuery] int? tourId, [FromQuery] DateOnly? from,
            [FromQuery] DateOnly? to, [FromQuery] OrderStatus? status, CancellationToken cancellationToken)
        {
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var orders = await info.GetAllAsync(order =>
                (status == null || order.Status == status)
                && order.Lines.Any(line => (tourId == null || line.TourId == tourId)
                                          && (from == null || line.TourDate >= from)
                                          && (to == null || line.TourDate <= to)));

            return mapper.Map<List<OrderInfoModel>>(orders.OrderByDescending(order => order.CreatedAtUtc));
        }

        // Владелец или тот, у кого есть orders.Update — общая проверка для Update/UpdateAsync
        // и любого другого действия, которое пользователь может совершить над СВОИМ заказом.
        // Раньше проверялось User.IsInRole(Admin): с гибкими ролями это было бы дырой в обе
        // стороны — роль, буквально названная «Admin», но лишённая orders.Update, сохраняла
        // бы доступ к чужим заказам, а кастомная роль с реальным orders.Update — не получала
        // бы его. HasPermission читает то же самое, чем гейтится admin-путь ниже по файлу.
        private async Task EnsureOwnerOrAdminAsync(int orderId, CancellationToken cancellationToken)
        {
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var order = await info.GetByIdAsync(orderId, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {orderId} not found.");

            if (order.UserId != User.GetUserId() && !User.HasPermission(AdminScreens.Orders, PermissionAction.Update))
                throw new ErrorModelException(GlobalErrorCode.OrderAccessForbidden, HttpStatusCode.Forbidden,
                    $"Order with id {orderId} belongs to another user.");
        }
    }
}
