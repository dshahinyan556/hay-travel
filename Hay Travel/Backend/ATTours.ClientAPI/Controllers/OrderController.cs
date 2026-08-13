using ATTours.BusinessServices.Email;
using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.ClientAPI.Authorization;
using ATTours.ClientAPI.Extensions;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Init;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
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
    // Бронирования (spec 001). Стиль контроллеров проекта: сервисы через new + using,
    // в конструкторе только IMapper (плюс IEmailSender — он, как и в AuthController,
    // регистрируется в DI как singleton, `new` для него не годится: выбор реализации
    // по конфигу невыразим в конструкторе сервиса).
    //
    // Гостевой брони нет: создать заказ может любой аутентифицированный пользователь
    // (роль значения не имеет), поэтому [Authorize] без ролей. Id владельца ВСЕГДА берётся
    // из токена (User.GetUserId()) и никогда из тела запроса — иначе эндпоинт позволял бы
    // оформить бронь на чужой аккаунт (IDOR), как и в AccountController.
    [ApiController]
    [Route("api/[controller]")]
    public class OrderController(IMapper mapper, IEmailSender emailSender) : Controller
    {
        [HttpPost]
        [Route("Create")]
        [Authorize]
        public async Task<OrderInfoModel> CreateAsync([FromBody] OrderCreateModel model, CancellationToken cancellationToken)
        {
            var entity = mapper.Map<Order>(model);

            using (var creationService = new OrderCreationService(entity, User.GetUserId(), cancellationToken))
                await creationService.ExecuteEntityChangesAsync();

            // Перечитываем: ответ несёт денормализованные поля (пользователь, тур) и платёж,
            // которых у только что собранной сущности нет.
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var result = mapper.Map<OrderInfoModel>(await info.GetByIdAsync(entity.Id, cancellationToken));

            // Флоу заказов (B12): каждая новая бронь ждёт подтверждения — админ должен об
            // этом узнать, а не наткнуться на неё сам в календаре. Провайдер письма не
            // бросает наружу (см. Brevo/SendGridEmailSender.SendAsync) — сбой уведомления
            // не должен ронять уже оформленную бронь.
            await emailSender.SendNewOrderNotificationAsync(result.TourTitle, result.TourDate, result.GuestCount,
                result.UserFullName, result.UserEmail, cancellationToken);

            return result;
        }

        // Деталь одного заказа для админского OrderDetailPage (B12, 2026-08-13) — только
        // админ: экран, которому это нужно, целиком под /admin, у «моих заказов» своя
        // страница деталей не заведена (YAGNI, как и в GetMine).
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

        // Правка даты/числа гостей, пока заказ ждёт подтверждения. Тот же владелец/админ
        // доступ, что и у Cancel — своя бронь или любая, если админ.
        [HttpPut]
        [Route("Update")]
        [Authorize]
        public async Task<OrderInfoModel> UpdateAsync([FromBody] OrderUpdateModel model, CancellationToken cancellationToken)
        {
            using (var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken))
            {
                var existing = await info.GetByIdAsync(model.Id, cancellationToken)
                               ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                                   $"Order with id {model.Id} not found.");

                if (existing.UserId != User.GetUserId() && !User.IsInRole(ApiRoles.Admin))
                    throw new ErrorModelException(GlobalErrorCode.OrderAccessForbidden, HttpStatusCode.Forbidden,
                        $"Order with id {model.Id} belongs to another user.");
            }

            using (var updateService = new OrderUpdateService(cancellationToken))
                await updateService.UpdateAsync(model.Id, model.TourDate, model.GuestCount);

            using var refreshedInfo = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return mapper.Map<OrderInfoModel>(await refreshedInfo.GetByIdAsync(model.Id, cancellationToken));
        }

        // Ручное подтверждение — только админ (B12).
        [HttpPatch]
        [Route("Confirm")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task ConfirmAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var confirmationService = new OrderConfirmationService(cancellationToken);
            await confirmationService.ConfirmAsync(id);
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
                order.Tour?.ExtractWithNeededLanguage(languageCode);

            return mapper.Map<List<OrderInfoModel>>(orders.OrderByDescending(order => order.CreatedAtUtc));
        }

        // Админский список. Фильтры опциональны и складываются в один предикат (уезжает в SQL);
        // заголовок тура — русский (в админке язык не переключается).
        [HttpGet]
        [Route("GetAll")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task<List<OrderInfoModel>> GetAllAsync([FromQuery] int? tourId, [FromQuery] DateOnly? from,
            [FromQuery] DateOnly? to, [FromQuery] OrderStatus? status, CancellationToken cancellationToken)
        {
            using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            var orders = await info.GetAllAsync(order => (tourId == null || order.TourId == tourId)
                                                         && (from == null || order.TourDate >= from)
                                                         && (to == null || order.TourDate <= to)
                                                         && (status == null || order.Status == status));

            return mapper.Map<List<OrderInfoModel>>(orders.OrderByDescending(order => order.CreatedAtUtc));
        }

        // Отмена. Проверка владельца — здесь, а не в сервисе: только у контроллера есть
        // и id из токена, и роль. Админ может отменить любой заказ, обычный пользователь — свой.
        [HttpPatch]
        [Route("Cancel")]
        [Authorize]
        public async Task CancelAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using (var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken))
            {
                var order = await info.GetByIdAsync(id, cancellationToken)
                            ?? throw new ErrorModelException(GlobalErrorCode.OrderNotFound, HttpStatusCode.NotFound,
                                $"Order with id {id} not found.");

                if (order.UserId != User.GetUserId() && !User.IsInRole(ApiRoles.Admin))
                    throw new ErrorModelException(GlobalErrorCode.OrderAccessForbidden, HttpStatusCode.Forbidden,
                        $"Order with id {id} belongs to another user.");
            }

            using var cancellationService = new OrderCancellationService(cancellationToken);
            await cancellationService.CancelAsync(id);
        }
    }
}
