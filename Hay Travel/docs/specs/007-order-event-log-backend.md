# Spec 007 — Журнал событий заказа (OrderEvent), backend

Статус: принято к реализации (backend-developer).
Дата: 2026-08-21.
Связанные решения: [ADR 020](../adr/020-order-event-log-outside-mutation-transaction.md),
[ADR 019](../adr/019-order-becomes-multi-line-orderpayment-becomes-ledger.md).

## Задача
Read-only журнал событий заказа под новый таб «История» на админской странице заказа.
Пишется автоматически при каждой мутации заказа, читается отдельным эндпоинтом.
Мультиязычности НЕТ: текст события — готовая русская строка (внутренний админский лог).

Ориентир (существующий вертикальный срез): `OrderPayment` — сущность-журнал, привязанная к
заказу через строку, + `LoginHistory` — аудит без обратной навигации на владельца.
Читать перед началом: `ATTours.Common/Entities/OrderPayment.cs`,
`Infrastructure/EntityConfiguration/OrderPaymentConfiguration.cs`,
`ATTours.Service/Services/InfoServices/LoginHistoryInfo.cs`.

---

## 1. Файлы по проектам

### ATTours.Common

| Файл | Действие | Что внутри |
| --- | --- | --- |
| `Enums/OrderEventType.cs` | создать | enum, значения ниже |
| `Entities/OrderEvent.cs` | создать | сущность, поля ниже |
| `Infrastructure/EntityConfiguration/OrderEventConfiguration.cs` | создать | Fluent-конфиг, ниже |
| `DTO/Info/OrderEventInfoModel.cs` | создать | Info-DTO, ниже |

`Entities/Order.cs` НЕ трогаем: обратной коллекции `Order.Events` не добавляем — граф заказа
(`OrderInfo`) журнал не читает, а связь настраивается через `WithMany()` без навигации (тот же
приём, что у `Order.User` и `LoginHistory.User`).

```csharp
// ATTours.Common/Enums/OrderEventType.cs
public enum OrderEventType
{
    Created = 1,
    StatusChanged = 2,
    Updated = 3,            // правка брони владельцем/админом (дата/гости)
    LineAdded = 4,
    LineRemoved = 5,
    LineUpdated = 6,
    EmployeeAssigned = 7,
    SentToClient = 8,
    PaymentAdded = 9
}
```

```csharp
// ATTours.Common/Entities/OrderEvent.cs
[EntityTypeConfiguration(typeof(OrderEventConfiguration))]
public class OrderEvent : EntityBase
{
    public int OrderId { get; set; }
    public Order Order { get; set; }

    public OrderEventType Type { get; set; }

    // Готовая русская строка для админского таба «История». Не переводится
    // (ITranslatableModel НЕ реализуется) — это внутренний лог, а не контент сайта.
    public string Description { get; set; }

    // Кто выполнил. FK на User сознательно НЕ ставится (см. конфиг) — журнал не должен
    // зависеть от жизненного цикла учётки, имя уже денормализовано в ActorFullName.
    public int? ActorUserId { get; set; }

    // Снапшот имени на момент события: пользователь потом может сменить имя,
    // а история обязана показывать то, что было тогда. Null — событие без автора.
    public string ActorFullName { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}
```

```csharp
// ATTours.Common/Infrastructure/EntityConfiguration/OrderEventConfiguration.cs
builder.ToTable(nameof(OrderEvent));

// Cascade: удаление заказа целиком уносит и его историю. Журнал осиротевшего заказа
// никому не показывается — отдельного архива удалённых заказов в системе нет.
builder.HasOne(x => x.Order).WithMany().HasForeignKey(x => x.OrderId)
       .OnDelete(DeleteBehavior.Cascade);

builder.Property(x => x.Description).IsRequired().HasMaxLength(1000);
builder.Property(x => x.ActorFullName).HasMaxLength(200);
builder.Property(x => x.CreatedAtUtc).IsRequired();

// История всегда читается точечно, по одному заказу, отсортированной по времени.
builder.HasIndex(x => new { x.OrderId, x.CreatedAtUtc });
```

Навигации `User` у `ActorUserId` нет и FK не создаётся — просто `int?`-колонка.

```csharp
// ATTours.Common/DTO/Info/OrderEventInfoModel.cs
public class OrderEventInfoModel
{
    public int Id { get; set; }
    public OrderEventType Type { get; set; }   // на проводе числом, фронт выбирает иконку
    public string Description { get; set; }
    public int? ActorUserId { get; set; }
    public string ActorFullName { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
```

### ATTours.DataLayer

| Файл | Действие | Что внутри |
| --- | --- | --- |
| `ATToursContext.cs` | изменить | `public DbSet<OrderEvent> OrderEvents { get; set; }` рядом с `OrderPayments` |
| `Migrations/*` | создать | `dotnet ef migrations add AddOrderEvent` — миграция НУЖНА, применяется автоматически на старте API |

### ATTours.Service (ATTours.BusinessServices)

| Файл | Действие | Что внутри |
| --- | --- | --- |
| `Services/CreateServices/OrderEventService.cs` | создать | запись события + резолв контекста (см. §2) |
| `Services/Shared/OrderEventLog.cs` | создать | статический фасад: один метод на событие, собирает текст, НЕ бросает (см. §2, §3) |
| `Services/InfoServices/OrderEventInfo.cs` | создать | чтение истории по заказу |
| `Services/UpdateServices/OrderStatusService.cs` | изменить | `SetStatusAsync` возвращает `OrderStatusChangeResult` |
| `Services/UpdateServices/OrderUpdateService.cs` | изменить | `UpdateAsync` возвращает `OrderUpdateResult` вместо `Order` |
| `Services/UpdateServices/OrderLineService.cs` | изменить | `RemoveLineAsync` возвращает `OrderLineRemovedResult` |

Другие сервисы заказа (`OrderCreationService`, `OrderPaymentCreationService`,
`OrderAssignEmployeeService`, `OrderLineService.AddLineAsync/UpdateLineAsync`) НЕ меняются:
всё, что нужно для текста события, `OrderEventLog` дочитывает сам по `lineId`/`paymentId`.

### ATTours.ClientAPI

| Файл | Действие | Что внутри |
| --- | --- | --- |
| `Controllers/OrderController.cs` | изменить | 8 вызовов логирования (§3) + новый эндпоинт `GET {id:int}/Events` (§4) |
| `Mapper/MappingProfile.cs` | изменить | `CreateMap<OrderEvent, OrderEventInfoModel>();` в блок `Mappings for ORDER` |
| `Startup.cs` | НЕ трогать | сервисы заказа создаются через `new` + `using`, DI-регистрация не нужна |

### ATTours.Helper / ATTours.ContextRepository
Изменений нет. Новых `GlobalErrorCode` не заводим: журнал read-only и никогда не бросает.

---

## 2. Контракты сервисов

```csharp
// ATTours.Service/Services/CreateServices/OrderEventService.cs
// Пишет строку журнала. Наследование и стиль — как у OrderPaymentCreationService.
public class OrderEventService : RepositoryCoreBase<OrderEvent, ATToursContextFactory>
{
    public OrderEventService(CancellationToken cancellationToken = default);

    // Резолвит ActorFullName (User.FirstName + LastName, иначе Username, иначе null),
    // ставит CreatedAtUtc = DateTime.UtcNow, Add + SaveChanges.
    public Task WriteAsync(int orderId, int? actorUserId, OrderEventType type, string description);

    // Контекст для текста события, дочитывается ЗДЕСЬ, а не в контроллере.
    // Возвращает null, если строки/проводки уже нет.
    public Task<OrderEventLineContext> GetLineContextAsync(int lineId);
    public Task<OrderEventPaymentContext> GetPaymentContextAsync(int paymentId);
    public Task<string> GetTourTitleAsync(int tourId);
}

public class OrderEventLineContext
{
    public int OrderId { get; set; }
    public string TourTitle { get; set; }
    public DateOnly TourDate { get; set; }
    public int GuestCount { get; set; }
    public bool RequiresPrepayment { get; set; }
    public decimal PrepaymentAmount { get; set; }
    public string PickupDetails { get; set; }
    public string NavigatorLink { get; set; }
}

public class OrderEventPaymentContext
{
    public int OrderId { get; set; }
    public string Number { get; set; }
    public OrderPaymentType Type { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; }
    public string TourTitle { get; set; }
    public DateOnly TourDate { get; set; }
}
```

Заголовок тура резолвится тем же правилом, что в `MappingProfile.ResolveTourTitle`: перевод
`TourTranslationType.Title` с `LanguageCode.Russian`, иначе первый попавшийся, иначе `null`
(в тексте события подставлять `«тур не найден»` вместо null не надо — писать `«—»`).

```csharp
// ATTours.Service/Services/Shared/OrderEventLog.cs
// Статический фасад — вызывается из контроллера одной строкой, стиль как у
// OrderNumberGenerator/OrderPdfService. НИ ОДИН метод не бросает наружу: внутри
// try/catch (Exception) с молчаливым проглатыванием (ADR 020).
public static class OrderEventLog
{
    public static Task LogOrderCreatedAsync(int orderId, int actorUserId, CancellationToken ct);

    public static Task LogStatusChangedAsync(int orderId, int actorUserId, OrderStatus previous,
        OrderStatus current, string rejectReason, CancellationToken ct);

    public static Task LogOrderUpdatedAsync(int orderId, int actorUserId, DateOnly previousDate,
        int previousGuestCount, DateOnly currentDate, int currentGuestCount, CancellationToken ct);

    public static Task LogLineAddedAsync(int lineId, int actorUserId, CancellationToken ct);
    public static Task LogLineUpdatedAsync(int lineId, int actorUserId, CancellationToken ct);

    // Строки уже нет в БД — данные приходят снапшотом из OrderLineService.RemoveLineAsync.
    public static Task LogLineRemovedAsync(int orderId, int actorUserId, int tourId,
        DateOnly tourDate, int guestCount, CancellationToken ct);

    public static Task LogEmployeeAssignedAsync(int orderId, int actorUserId, string employeeFullName,
        List<int> assignedLineIds, bool allLines, CancellationToken ct);

    public static Task LogSentToClientAsync(int orderId, int actorUserId, string clientEmail, CancellationToken ct);

    public static Task LogPaymentAddedAsync(int paymentId, int actorUserId, CancellationToken ct);
}
```

```csharp
// ATTours.Service/Services/InfoServices/OrderEventInfo.cs — по образцу LoginHistoryInfo.
public class OrderEventInfo : EntityInfoBase<OrderEvent>
{
    public OrderEventInfo();
    public OrderEventInfo(string connectionString, CancellationToken cancellationToken = default);
    public OrderEventInfo(IApplicationDbContext context, CancellationToken cancellationToken = default);

    // Новые сверху. Include не нужен: DTO плоская, автор денормализован в самой строке.
    public Task<List<OrderEvent>> GetByOrderAsync(int orderId, CancellationToken cancellationToken = default);
}
```
Сортировка: `.OrderByDescending(x => x.CreatedAtUtc).ThenByDescending(x => x.Id)`. Лимита
(`Take`) НЕТ: событий у одного заказа десятки, не тысячи.

### Изменяемые сигнатуры существующих сервисов

```csharp
// OrderStatusService — нужен предыдущий статус для текста события.
public async Task<OrderStatusChangeResult> SetStatusAsync(int id, OrderStatus status, string rejectReason);
public class OrderStatusChangeResult
{
    public OrderStatus PreviousStatus { get; set; }
    public OrderStatus CurrentStatus { get; set; }
    public string RejectReason { get; set; }
}

// OrderUpdateService — нужны старые дата/гости. Возвращаемый Order сейчас никем не
// используется (контроллер перечитывает заказ через OrderInfo), поэтому меняем тип.
public async Task<OrderUpdateResult> UpdateAsync(int id, DateOnly tourDate, int guestCount);
public class OrderUpdateResult
{
    public DateOnly PreviousTourDate { get; set; }
    public int PreviousGuestCount { get; set; }
    public DateOnly CurrentTourDate { get; set; }
    public int CurrentGuestCount { get; set; }
}

// OrderLineService — снапшот удаляемой строки (после Remove читать уже нечего).
public async Task<OrderLineRemovedResult> RemoveLineAsync(int lineId);
public class OrderLineRemovedResult
{
    public int OrderId { get; set; }
    public int TourId { get; set; }
    public DateOnly TourDate { get; set; }
    public int GuestCount { get; set; }
}
```
Result-классы объявляются в файле своего сервиса — как `OrderAssignEmployeeResult` в
`OrderAssignEmployeeService.cs`.

---

## 3. Точки логирования в OrderController

Вызов ставится ПОСЛЕ успешного завершения мутации (после `using`-блока сервиса мутации), до
`return`. Порядок относительно отправки письма значения не имеет.

| Эндпоинт | Вызов | Actor |
| --- | --- | --- |
| `CreateAsync` | `LogOrderCreatedAsync(orderId, ...)` | `User.GetUserId()` (клиент) |
| `UpdateAsync` | `LogOrderUpdatedAsync(model.Id, ..., result.Previous*, result.Current*)` | `User.GetUserId()` |
| `SetStatusAsync` | `LogStatusChangedAsync(model.Id, ..., result.PreviousStatus, result.CurrentStatus, result.RejectReason)` | `User.GetUserId()` |
| `AddLineAsync` | `LogLineAddedAsync(line.Id, ...)` | `User.GetUserId()` |
| `RemoveLineAsync` | `LogLineRemovedAsync(result.OrderId, ..., result.TourId, result.TourDate, result.GuestCount)` | `User.GetUserId()` |
| `UpdateLineAsync` | `LogLineUpdatedAsync(model.Id, ...)` | `User.GetUserId()` |
| `AssignEmployeeAsync` | `LogEmployeeAssignedAsync(model.OrderId, ..., assignment.EmployeeFullName, assignment.AssignedLineIds, model.LineId is null)` | `User.GetUserId()` |
| `SendToClientAsync` | `LogSentToClientAsync(id, ..., orderDto.UserEmail)` | `User.GetUserId()` |
| `AddPaymentAsync` | `LogPaymentAddedAsync(payment.Id, ...)` | `User.GetUserId()` |
| `DeleteAsync` | НЕ логируем | — |

`DeleteAsync` не логируется сознательно: cascade сносит журнал вместе с заказом, событие
«заказ удалён» физически некуда положить (отдельной таблицы аудита уровня системы нет и
заводить её в этой задаче не будем).

### Тексты событий (ru, ровно эти формулировки)
Даты — `dd.MM.yyyy`, суммы — `N0` в `ru-RU`, названия туров — в «ёлочках».

| Тип | Текст |
| --- | --- |
| Created | `Заказ создан` |
| StatusChanged | `Статус изменён: «{prev}» → «{curr}»`; при `Rejected` добавить `. Причина отказа: {reason}` (если пусто — `. Причина отказа не указана`) |
| Updated | `Изменена бронь: ` + перечисление только изменившегося через `, `: `дата 12.09.2026 → 15.09.2026`, `гостей 2 → 3`. Если не изменилось ничего — событие НЕ пишем |
| LineAdded | `Добавлена строка: «{tour}», {date}, гостей: {n}` |
| LineRemoved | `Удалена строка: «{tour}», {date}, гостей: {n}` |
| LineUpdated | `Изменена строка «{tour}», {date}: предоплата — {требуется, {amount} / не требуется}, место встречи — {указано / не указано}, навигатор — {указан / не указан}` |
| EmployeeAssigned | все строки: `Назначен исполнитель {name} на все строки заказа ({count})`; одна: `Назначен исполнитель {name} на строку «{tour}», {date}` |
| SentToClient | `Заказ отправлен клиенту на {email}` |
| PaymentAdded | `Проведена оплата {number}: {Предоплата/Оплата} {amount} {currency} по строке «{tour}», {date}` |

Русские названия статусов (словарь в `OrderEventLog`): Open — `Открыт`, Hold — `На удержании`,
Approved — `Одобрен`, Rejected — `Отклонён`, ReadyForAssignment — `Готов к назначению`,
PendingPayment — `Ожидает оплаты`, Completed — `Выполнен`.

---

## 4. Чтение: отдельный эндпоинт

```csharp
// OrderController
[HttpGet]
[Route("{id:int}/Events")]
[Authorize(Roles = ApiRoles.Admin)]
public async Task<List<OrderEventInfoModel>> GetEventsAsync(int id, CancellationToken cancellationToken)
```
Тело: `using var info = new OrderEventInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);`
→ `GetByOrderAsync(id, cancellationToken)` → `mapper.Map<List<OrderEventInfoModel>>(...)`.
Заказ на существование НЕ проверяем: у несуществующего заказа история пустая, 404 здесь не нужен.

Поле `Events` в `OrderInfoModel` НЕ добавляем — обоснование в ADR 020 (граф `OrderInfo`
переиспользуется публичным «Мои заказы», админским списком, PDF и письмами; журнал грузился
бы всюду и рос бы без границ).

---

## 5. Вне скоупа
- Фронтенд-таб «История» (отдельная задача, `admin-panel`).
- Логирование удаления заказа и любых мутаций вне `OrderController`.
- Структурированный payload события (old/new значения полями/JSON) — только текст + тип.
- Фильтрация/пагинация журнала, экспорт, ретеншн-политика.
- Мультиязычность журнала, `ITranslatableModel`.
- Логирование в журнал системных/фоновых операций (курсы валют, авто-статусы).
- Изменения в DI (`Startup.cs`), в цепочке обработки исключений, новые `GlobalErrorCode`.
