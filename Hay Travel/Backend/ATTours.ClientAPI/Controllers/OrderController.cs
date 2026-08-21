using ATTours.BusinessServices.Email;
using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.PdfServices;
using ATTours.BusinessServices.Services.Shared;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.ClientAPI.Extensions;
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
    // (плюс IEmailSender — singleton в DI, `new` для него не годится).
    //
    // Гостевой брони нет: создать заказ может любой аутентифицированный пользователь
    // (роль значения не имеет), поэтому [Authorize] без ролей на Create. Id владельца ВСЕГДА
    // берётся из токена (User.GetUserId()), никогда из тела запроса (IDOR).
    [ApiController]
    [Route("api/[controller]")]
    public class OrderController(IMapper mapper, IEmailSender emailSender) : Controller
    {
        [HttpPost]
        [Route("Create")]
        [Authorize]
        public async Task<OrderInfoModel> CreateAsync([FromBody] OrderCreateModel model, CancellationToken cancellationToken)
        {
            int orderId;
            using (var creationService = new OrderCreationService(model.TourId, model.TourDate, model.GuestCount, User.GetUserId(), cancellationToken))
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
            // бросает наружу (см. Brevo/SendGridEmailSender.SendAsync) — сбой уведомления
            // не должен ронять уже оформленную бронь. Бронь с сайта — всегда одна строка.
            var line = result.Lines.Single();
            await emailSender.SendNewOrderNotificationAsync(line.TourTitle, line.TourDate, line.GuestCount,
                result.UserFullName, result.UserEmail, cancellationToken);

            await OrderEventLog.LogOrderCreatedAsync(orderId, User.GetUserId(), cancellationToken);

            return result;
        }

        // Деталь одного заказа для админского OrderDetailPage — только админ.
        [HttpGet]
        [Route("{id:int}")]
        [Authorize(Roles = ApiRoles.Admin)]
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
        [Authorize(Roles = ApiRoles.Admin)]
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
        [Authorize(Roles = ApiRoles.Admin)]
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
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task RemoveLineAsync([FromQuery] int lineId, CancellationToken cancellationToken)
        {
            OrderLineRemovedResult removed;
            using (var lineService = new OrderLineService(cancellationToken))
                removed = await lineService.RemoveLineAsync(lineId);

            await OrderEventLog.LogLineRemovedAsync(removed.OrderId, User.GetUserId(), removed.TourId,
                removed.TourDate, removed.GuestCount, cancellationToken);
        }

        // Правка строки: предоплата + "детали для выполнения" — только админ.
        [HttpPut]
        [Route("UpdateLine")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task UpdateLineAsync([FromBody] OrderLineUpdateModel model, CancellationToken cancellationToken)
        {
            using (var lineService = new OrderLineService(cancellationToken))
                await lineService.UpdateLineAsync(model);

            await OrderEventLog.LogLineUpdatedAsync(model.Id, User.GetUserId(), cancellationToken);
        }

        // "Назначить" / "Назначить и отправить" (Фаза 5.2) — на одну строку или на все
        // (model.LineId == null). При model.SendEmail (по умолчанию true) исполнителю сразу
        // уходит письмо с PDF-вложением только по назначенным строкам; попап админки шлёт
        // false для тихого назначения (Давид, 2026-08-21). Сбой письма не должен откатывать
        // уже сохранённое назначение — тот же принцип, что у SendNewOrderNotificationAsync
        // в CreateAsync (провайдер не бросает наружу).
        [HttpPatch]
        [Route("AssignEmployee")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task AssignEmployeeAsync([FromBody] OrderAssignEmployeeModel model, CancellationToken cancellationToken)
        {
            OrderAssignEmployeeResult assignment;
            using (var assignService = new OrderAssignEmployeeService(cancellationToken))
                assignment = await assignService.AssignAsync(model);

            if (model.SendEmail)
            {
                using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
                var order = await info.GetByIdAsync(model.OrderId, cancellationToken);
                var orderDto = mapper.Map<OrderInfoModel>(order);

                var pdfDocument = OrderPdfService.GenerateAssignmentDocument(orderDto, assignment.AssignedLineIds);
                var details = BuildAssignmentDetailsText(orderDto, assignment.AssignedLineIds);

                await emailSender.SendAssignmentAsync(assignment.EmployeeEmail, assignment.EmployeeFullName,
                    orderDto.Number, details, pdfDocument, cancellationToken);
            }

            await OrderEventLog.LogEmployeeAssignedAsync(model.OrderId, User.GetUserId(), assignment.EmployeeFullName,
                assignment.AssignedLineIds, model.LineId is null, cancellationToken);
        }

        // "Отправить заказ" клиенту (Фаза 5.1) — весь заказ PDF-вложением, простое письмо.
        [HttpPost]
        [Route("SendToClient")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task SendToClientAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var order = await info.GetByIdAsync(id, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {id} not found.");
            var orderDto = mapper.Map<OrderInfoModel>(order);

            var pdfDocument = OrderPdfService.GenerateOrderDocument(orderDto);
            await emailSender.SendOrderDocumentAsync(orderDto.UserEmail, orderDto.UserFullName, orderDto.Number, pdfDocument, cancellationToken);

            await OrderEventLog.LogSentToClientAsync(id, User.GetUserId(), orderDto.UserEmail, cancellationToken);
        }

        // Ручная проводка (предоплата/оплата) по строке — только админ, нет платёжного шлюза.
        [HttpPost]
        [Route("AddPayment")]
        [Authorize(Roles = ApiRoles.Admin)]
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
        [Authorize(Roles = ApiRoles.Admin)]
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
        [Authorize(Roles = ApiRoles.Admin)]
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
        [Authorize(Roles = ApiRoles.Admin)]
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

        // Текст в тело письма исполнителю (Фаза 5.2) — дублирует то, что уже есть в PDF, но
        // Давид явно просил текст самого письма, а не только вложение (checklist Фаза 5.2).
        private static string BuildAssignmentDetailsText(OrderInfoModel order, List<int> lineIds)
        {
            var blocks = order.Lines
                .Where(line => lineIds.Contains(line.Id))
                .Select(line =>
                    $"Тур: {line.TourTitle}\n" +
                    $"Дата: {line.TourDate:dd.MM.yyyy}, гостей: {line.GuestCount}\n" +
                    $"Место встречи: {(string.IsNullOrWhiteSpace(line.PickupDetails) ? "не указано" : line.PickupDetails)}\n" +
                    $"Навигатор: {(string.IsNullOrWhiteSpace(line.NavigatorLink) ? "не указан" : line.NavigatorLink)}");

            return string.Join("\n\n", blocks);
        }

        // Владелец или админ — общая проверка для Update/UpdateAsync и любого другого
        // действия, которое пользователь может совершить над СВОИМ заказом.
        private async Task EnsureOwnerOrAdminAsync(int orderId, CancellationToken cancellationToken)
        {
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var order = await info.GetByIdAsync(orderId, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                            $"Order with id {orderId} not found.");

            if (order.UserId != User.GetUserId() && !User.IsInRole(ApiRoles.Admin))
                throw new ErrorModelException(GlobalErrorCode.OrderAccessForbidden, HttpStatusCode.Forbidden,
                    $"Order with id {orderId} belongs to another user.");
        }
    }
}
