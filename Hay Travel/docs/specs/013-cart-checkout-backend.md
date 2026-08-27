# Spec 013 — Бэкенд чекаута корзины: один мультистрочный заказ

- Дата: 2026-08-22
- Архитектурное обоснование: [ADR 025](../adr/025-cart-checkout-single-multiline-order.md)
  (разворачивает часть ADR 022 и его «бэкенд не меняется»)
- Исполнитель: `backend-developer`
- Ориентир (существующий вертикальный срез): текущий `Order` / `OrderCreationService` /
  `OrderValidationService` / `OrderController.CreateAsync` — переделываем ИХ, а не пишем срез
  с нуля. Паттерн пер-строчного HTML для письма копируем с `BuildAssignmentDetailsHtml`
  в `OrderNotificationService`.

## 0. Что делаем в одном абзаце

`POST api/Order/Create` начинает принимать список строк (`OrderCreateModel.Lines`) и создаёт
**один** `Order` с N `OrderLine` за один запрос, атомарно: если хотя бы одна строка не проходит
валидацию — не пишется ничего, а клиенту возвращается пер-строчный список ошибок
(`{ index, tourId, tourDate, errorCode }`). Успех — как раньше, `OrderInfoModel` (в нём уже
есть `Lines`).

## 1. Инварианты (не нарушать)

- ОДИН `Order` на весь чекаут. НЕ создавать N заказов, НЕ инстанцировать
  `OrderCreationService` в цикле, НЕ делать N `SaveChanges`. Один агрегат `Order` с N `Lines`
  в коллекции → один `SaveChangesAsync` = одна транзакция (см. §5).
- Владелец заказа — ВСЕГДА `User.GetUserId()` из токена, никогда из тела (IDOR, как сейчас).
- Обогащение серверных полей идёт ДО валидации (валидация видит проставленные сервером поля),
  и обогащение не должно падать NRE на несуществующем туре (оставить fallback `?? 0`/`null`;
  несуществующий тур отобьёт валидация кодом `TourNotFound`).
- Снапшот цены/скидки резолвится НА ДАТУ ПОЕЗДКИ КАЖДОЙ строки (не на дату оформления),
  правило `ResolveTotalAmount` (групповой тариф) не меняется.
- Ошибка отправки письма/записи журнала не откатывает уже созданный заказ (как сейчас).

## 2. Файлы по проектам

### ATTours.Common

**СОЗДАТЬ** `DTO/Init/OrderCreateLineModel.cs`
Одна позиция корзины в теле запроса создания заказа.
```csharp
namespace ATTours.Common.DTO.Init
{
    public class OrderCreateLineModel
    {
        public int TourId { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
    }
}
```
Не переиспользовать админский `OrderLineCreateModel` — у него `OrderId/RequiresPrepayment/
PrepaymentAmount` (другой сценарий).

**ИЗМЕНИТЬ** `DTO/Init/OrderCreateModel.cs`
Заменить три скалярных поля на список строк. Комментарий про «UserId из токена» сохранить.
```csharp
public class OrderCreateModel
{
    public List<OrderCreateLineModel> Lines { get; set; } = [];
}
```

**СОЗДАТЬ** `Exceptions/OrderLineValidationError.cs` (namespace `ATTours.Exceptions`)
Один пункт пер-строчной ошибки. `ErrorCode` — `int` (не `GlobalErrorCode`), чтобы Common не
зависел от Helper; наполняется вызывающим кодом как `(int)GlobalErrorCode.X`.
```csharp
namespace ATTours.Exceptions
{
    public class OrderLineValidationError
    {
        public int Index { get; set; }        // 0-based индекс строки в запросе = позиция корзины
        public int TourId { get; set; }
        public DateOnly TourDate { get; set; }
        public int ErrorCode { get; set; }     // (int)GlobalErrorCode для этой строки
    }
}
```

**СОЗДАТЬ** `Exceptions/OrderLinesValidationException.cs` (namespace `ATTours.Exceptions`)
Наследует `ErrorModelException` (несёт плоский `ErrorCode` + список строк). Конструктор
проставляет верхнеуровневый код `OrderHasInvalidLines`.
```csharp
using System.Net;
namespace ATTours.Exceptions
{
    public class OrderLinesValidationException : ErrorModelException
    {
        public OrderLinesValidationException(Enum errorCode, IReadOnlyList<OrderLineValidationError> lineErrors)
            : base(errorCode, HttpStatusCode.BadRequest, "One or more order lines are invalid.")
        {
            LineErrors = lineErrors;
        }
        public IReadOnlyList<OrderLineValidationError> LineErrors { get; }
    }
}
```
Примечание: `errorCode` передаётся вызывающим как `GlobalErrorCode.OrderHasInvalidLines`
(Service ссылается на Helper; сам класс исключения остаётся в Common на generic `Enum`, как
`ErrorModelException`).

### ATTours.Helper

**ИЗМЕНИТЬ** `Enums/GlobalErrorCode.cs` — добавить в блок `EntityErrors` после 2030:
```csharp
[Description("Order has one or more invalid lines.")]
OrderHasInvalidLines = 2031,
[Description("Order cannot have more than 10 lines.")]
OrderTooManyLines = 2032,
```

**СОЗДАТЬ** `ErrorModels/OrderLinesErrorModel.cs`
Расширяет `ErrorModel` (плоский `ErrorCode` наследуется) списком строк.
```csharp
namespace ATTours.Helper.ErrorModels
{
    public class OrderLinesErrorModel : ErrorModel
    {
        public List<OrderLineErrorItem> Lines { get; set; } = [];
    }
    public class OrderLineErrorItem
    {
        public int Index { get; set; }
        public int TourId { get; set; }
        public DateOnly TourDate { get; set; }
        public int ErrorCode { get; set; }
    }
}
```

**СОЗДАТЬ** `ExceptionHandlers/OrderLinesValidationExceptionHandler.cs`
По образцу `ErrorModelExceptionHandler` (тот заполняет `ErrorCode`), плюс проекция `LineErrors`.
```csharp
public class OrderLinesValidationExceptionHandler
    : ATToursExceptionHandler<OrderLinesValidationException, OrderLinesErrorModel>
```
В `GetErrorModelAsync()`: вызвать `base`, затем `errorModel.ErrorCode = Convert.ToInt32(Exception.ErrorCode)`
и `errorModel.Lines = Exception.LineErrors.Select(...).ToList()`. В `GetDefaultErrorModel()` —
как в `ErrorModelExceptionHandler` (проставить `ErrorCode` + `Message`).

**СОЗДАТЬ** `ExceptionHandlerChains/OrderLinesValidationExceptionHandlerChain.cs`
```csharp
protected override bool CanHandle() => Exception is OrderLinesValidationException;
protected override IExceptionHandler CreateHandler()
    => new OrderLinesValidationExceptionHandler(HttpContext.Response, (OrderLinesValidationException)Exception);
```

### ATTours.ClientAPI

**ИЗМЕНИТЬ** `Middleware/ATToursExceptionMaster.cs`
Поставить новую цепочку ПЕРВОЙ (более специфичный подтип `ErrorModelException` — раньше базовой)
и связать цепочку корректно (сейчас `SetNext` вызывается дважды на голове — второй вызов
перезатирает первый; собрать нормальную связную цепочку):
```csharp
var orderLinesChain = new OrderLinesValidationExceptionHandlerChain(Exception, HttpContext);
var errorModelChain = new ErrorModelExceptionHandlerChain(Exception, HttpContext);
orderLinesChain
    .SetNextExceptionHandlerChain(errorModelChain)
    .SetNextExceptionHandlerChain(new MsSqlContextExceptionHandlerChain(Exception, HttpContext));
return orderLinesChain;
```
(`ATToursExceptionHandlerChain` в текущем коде и так был осиротевшим из-за двойного `SetNext`
на голове; если он нужен — вставить его звеном перед `MsSql`. По умолчанию восстанавливаем
поведение как было: ErrorModel → MsSql, с новой цепочкой впереди.)

**ИЗМЕНИТЬ** `Controllers/OrderController.CreateAsync`
Форма и глагол те же (`POST Create`, `[Authorize]`, ответ `OrderInfoModel`). Передать список
строк и владельца из токена в новый конструктор сервиса:
```csharp
using (var creationService = new OrderCreationService(model.Lines, User.GetUserId(), cancellationToken))
{
    await creationService.ExecuteEntityChangesAsync();
    orderId = creationService.Entities.Single().Id;   // по-прежнему ОДИН Order
}
```
Дальнейшая перечитка (`OrderInfo.GetByIdAsync`), `SendOrderCreatedAsync`, `LogOrderCreatedAsync`
— без изменений (заказ один). Ничего в контроллере не оборачивать в try/catch: валидацию
несёт `OrderLinesValidationException` через цепочку обработчиков.

### ATTours.Service (ATTours.BusinessServices)

**ИЗМЕНИТЬ** `Services/CreateServices/OrderCreationService.cs`
- Конструкторы: вместо `(int tourId, DateOnly tourDate, int guestCount, int userId, …)` —
  `(List<OrderCreateLineModel> lines, int userId, …)` (обе перегрузки: со `string
  connectionString` и с `IApplicationDbContext`). Базовый вызов остаётся `new Order()` (один
  агрегат). Сохранить приватные поля `userId` и `lines`.
- `GetEntityValidation()` — без изменений: `new OrderValidationService(Entities, Context)`.
- `EnrichAsync()`:
  - Order-level поля (один раз): `UserId`, `Currency = "AMD"`, `CreatedAtUtc = UtcNow`,
    `Number = OrderNumberGenerator.GenerateAsync(...)`.
  - Пер-строчно: для каждого `OrderCreateLineModel` из `lines` создать `OrderLine` с той же
    логикой снапшота, что сейчас (цена/скидка тура НА ДАТУ ПОЕЗДКИ строки, `ResolveTotalAmount`,
    `RequiresPrepayment = false`, `PrepaymentAmount = 0`), и `order.Lines.Add(line)` в порядке
    из запроса (индекс строки = позиция корзины; порядок должен сохраниться для отчёта об
    ошибке).
  - Оптимизация запроса (обязательна): не делать per-line запрос к `Tour`. Загрузить цены/скидки
    всех упомянутых `TourId` одним запросом в словарь `tourId → { TotalPrice, DiscountPercent,
    DiscountStartDate, DiscountValidUntil }` (`Where(t => tourIds.Contains(t.Id))`), затем
    резолвить снапшот каждой строки из словаря. Отсутствующий в словаре тур → `snapshot = 0`,
    `discountPercent = null` (не падать; валидация отобьёт `TourNotFound`).
  - Статус: без изменений — `order.Status = order.Lines.Any(l => l.RequiresPrepayment)
    ? PendingPayment : Open`.
- `ResolveTotalAmount` и константы тарифа — без изменений.

**ИЗМЕНИТЬ** `Services/ValidationServices/OrderValidationService.cs`
- Order-level guard (до пер-строчной проверки), плоскими `ErrorModelException`:
  - `order.Lines.Count == 0` → `throw new ErrorModelException(GlobalErrorCode.OrderMustHaveAtLeastOneLine, BadRequest, …)`.
  - `order.Lines.Count > 10` → `throw new ErrorModelException(GlobalErrorCode.OrderTooManyLines, BadRequest, …)`.
- Пер-строчная валидация перестаёт бросать на первой ошибке. Каждая из четырёх проверок
  (`ValidateGuestCount`, `ValidateDateNotInPast`, `ValidateTourIsBookableAsync`,
  `ValidateDateIsOpenAsync`) возвращает `GlobalErrorCode?` (или добавляет код в аккумулятор)
  вместо `throw`. Сами правила и коды НЕ меняются: `InvalidGuestCount` 2015, `OrderDateInPast`
  2016, `TourNotFound` 2004, `TourDateUnavailable` 2014.
- По каждой строке фиксируется ПЕРВАЯ сработавшая ошибка (одна причина на строку достаточно
  для UI; порядок проверок = как сейчас: гости → прошлое → тур существует → дата открыта).
  Строки без ошибок не попадают в список.
- Индекс строки берётся как позиция в `order.Lines` (0-based) — совпадает с позицией в запросе
  благодаря сохранённому порядку в `EnrichAsync`.
- Если аккумулятор непуст:
  `throw new OrderLinesValidationException(GlobalErrorCode.OrderHasInvalidLines, errors)`,
  где `errors` — `List<OrderLineValidationError> { Index, TourId, TourDate, ErrorCode }`.
- Можно оставить `ValidateDateIsOpenAsync` асинхронной (грузит `ClosureRule`); при желании
  оптимизировать — загрузить правила один раз на все строки (не обязательно для этой задачи).

**ИЗМЕНИТЬ** `Notifications/OrderNotificationService.cs` (`SendOrderCreatedAsync`)
- Убрать зависимость письма от «одной строки»: добавить значение нового плейсхолдера
  `OrderLines` как `PlaceholderValue.Html(BuildOrderLinesHtml(order))`, где `BuildOrderLinesHtml`
  рендерит ВСЕ строки заказа (тур/дата/гости построчно) — по образцу приватного
  `BuildAssignmentDetailsHtml` (безопасный HTML, строится бэком). Плоские
  `TourTitle/TourDate/GuestCount` оставить привязанными к первой строке (обратная совместимость
  уже существующих шаблонов).

**ИЗМЕНИТЬ** `../ATTours.Common/Constants/EmailPlaceholders.cs`
- Добавить `public const string OrderLines = nameof(OrderLines);`.
- В `TokensByKey[EmailActionKey.OrderCreated]` добавить `OrderLines` в список токенов.
- Комментарий про «единственное исключение AssignmentDetails строится как HTML» — расширить:
  теперь HTML-токенов два (`AssignmentDetails`, `OrderLines`).

## 3. Контракт запроса/ответа

### Запрос
`POST api/Order/Create`, `[Authorize]`, `Content-Type: application/json`
```json
{ "lines": [ { "tourId": 12, "tourDate": "2026-09-04", "guestCount": 2 }, { "tourId": 7, "tourDate": "2026-09-20", "guestCount": 4 } ] }
```

### Ответ — успех (200)
`OrderInfoModel` (без изменений формы) — один заказ, в `Lines` все строки. Маппинг AutoMapper
не трогается (`OrderInfoModel`/`OrderLineInfoModel` уже настроены; `GetMine`/`GetById` их уже
отдают).

### Ответ — отказ валидации (400)
`OrderLinesErrorModel`:
```json
{
  "httpStatusCode": 400,
  "message": "One or more order lines are invalid.",
  "errorCode": 2031,
  "lines": [
    { "index": 0, "tourId": 12, "tourDate": "2026-09-04", "errorCode": 2014 },
    { "index": 1, "tourId": 7,  "tourDate": "2026-09-20", "errorCode": 2004 }
  ]
}
```
`errorCode` верхнего уровня = 2031 (`OrderHasInvalidLines`); фронт-чекаут читает `lines[i]` и
сопоставляет по `index` (позиция корзины) либо по `tourId+tourDate`. Пер-строчные коды: 2004,
2014, 2015, 2016. Отказ формы (пустой список / >10) приходит обычным `ErrorModel` с плоским
кодом 2028 / 2032 и без массива `lines`.

## 4. Транзакционная гарантия (что проверить при реализации)

Ничего дополнительного оборачивать в транзакцию НЕ нужно. Достаточно: один `Order` с N `Lines`
в коллекции, один вызов `ExecuteEntityChangesAsync()` (внутри — enrich → validate → AddRange →
единственный `SaveChangesAsync`). Валидация бросает до `SaveChanges`, поэтому при ошибке в БД
не попадает ни одной строки. Убедиться, что `OrderLine` вставляются каскадом от `Order`
(навигация `Order.Lines`, как сейчас), а не отдельным путём.

## 5. Вне скоупа

- Клиентская архитектура корзины (localStorage-стор, снапшот отображения, иконка в шапке,
  экран `/cart`) — spec 008, зона фронт-архитектора/фронт-девелопера. Не трогать.
- Правка ADR 022 / spec 008 в части «N заказов → один заказ» — делает фронт-архитектор после
  этого ADR.
- Правка ТЕКСТОВ email-шаблонов в БД (вставка `{{OrderLines}}` в тело письма `order.created`) —
  это админ-контент, а не код; код лишь предоставляет плейсхолдер. Реализовать/задокументировать
  плейсхолдер обязательно, редактировать сохранённый текст шаблона — нет.
- Админские маршруты заказа (`AddLine`, `UpdateLine`, `SetStatus`, `AssignEmployee` и т.д.) —
  без изменений.
- Гостевой чекаут без авторизации — не вводим (как и раньше, `[Authorize]`).
- Окно бронирования «не дальше 3 месяцев» — по-прежнему фронтовый лимит, бэк его не проверяет
  (spec 001 §8), не добавлять.
