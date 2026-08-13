# Spec 001 — Backend: Календарь занятости + бронирования

Автор: `backend-architect`. Дата: 2026-08-11.
Статус: готово к реализации. Реализует `backend-developer`.
Связанные ADR: [012](../adr/012-closure-rules-stored-as-rules-not-materialized-dates.md)
(хранение правил закрытия), [014](../adr/014-order-money-in-separate-orderpayment-entity.md)
(денежная часть заказа в `OrderPayment`).

Эта спецификация самодостаточна: разработчик по ней сразу пишет код, без собственного анализа.
Открытых вопросов «на усмотрение разработчика» нет.

---

## 0. Ориентир — на какой вертикальный срез равняться

- **`Order` + `OrderPayment`** — по срезу **`Tour` (родитель) + дочерняя сущность с FK**:
  Entity → `[EntityTypeConfiguration]` → EF-config с `HasOne/WithMany`/`WithOne` →
  `CreateVerifiableEntityBase` + `EntityValidationContextDependentBase` (как `Place`) →
  `EntityInfoBase` c `Include` (как `TourInfo.IncludeTourGraph`) → контроллер в стиле
  `PlaceController` (сервисы через `new` + `using`, только `IMapper` в конструкторе).
- **Авторизация и «Id из токена, не из тела»** — по **`AccountController`** (`User.GetUserId()`,
  `[Authorize]`, комментарий про IDOR). Это критично: `Order.UserId` берётся ТОЛЬКО из токена.
- **Точечный патч статуса** (`OrderCancellationService`) — по **`TourActivationService`**
  (`RepositoryCoreBase`, грузит одну строку, меняет флаг, `SaveChangesAsync`).
- **Bulk create списком** — базы уже принимают `List<TEntity>` (см.
  `CreateVerifiableEntityBase` / `EntityCreationService` — конструкторы со списком).
- **Каталог с Create/Delete + защита целостности через сервис** — по срезу **`Place`**
  (`PlaceController` Create/Delete, `PlaceDeletionService`, `CatalogEntryInUse`).

Общие конвенции слоёв — `backend-stage3-architecture.md` §0 (namespace Service =
`ATTours.BusinessServices.*`; `ATToursContextFactory` в namespace `ArmeniaTours.DataLayer`;
enum на проводе — числом; DTO: `DTO/Init` без `Id` на создание, `DTO/Info` с `Id` на чтение,
`DTO/Request` — мелкие команды).

---

## 1. Мультиязычность, миграция, связи — сводка

- **Мультиязычность: НЕ нужна.** Ни `Order`, ни `OrderPayment`, ни `ClosureRule` не содержат
  переводимого пользователю контента. `ClosureRule.Reason` — единственная строка, это внутренняя
  админ-заметка, НЕ `*Translation`-таблица и НЕ `ITranslatableModel`. Никаких `LanguageCode`-
  колонок в новых сущностях.
- **Миграция: нужна одна** — `AddOrdersAndClosureRules` (3 таблицы, индексы, без `HasData`,
  без сида). Накатывается вручную после явного «go» Давида (правило проекта не меняется).
- **Связи:** `Order → User` (обяз.), `Order → Tour` (обяз.), `OrderPayment → Order` (1:1),
  `ClosureRule → Tour` (nullable; `null` = глобальное правило).
- **Даты — `DateOnly`** (SQL `date`) у `Order.TourDate` и всех дат `ClosureRule`; `DateTime`
  (UTC-конвертер) только у `Order.CreatedAtUtc`. Обоснование — ADR 012, раздел «Дата как DateOnly».

---

## 2. `ATTours.Common` — сущности, enum, конфигурации, DTO

### 2.1 Entities — `ATTours.Common/Entities/` (создать)

**`Order.cs`**
```
[EntityTypeConfiguration(typeof(OrderConfiguration))]
Order : EntityBase
    int UserId                 // из токена, не из тела запроса
    User User
    int TourId
    Tour Tour
    DateOnly TourDate          // календарный день брони
    int GuestCount
    OrderStatus Status         // enum, см. 2.3
    DateTime CreatedAtUtc      // UTC, ставит OrderCreationService = DateTime.UtcNow
    OrderPayment Payment       // 1:1, денежная часть (ADR 014)
```

**`OrderPayment.cs`**
```
[EntityTypeConfiguration(typeof(OrderPaymentConfiguration))]
OrderPayment : EntityBase
    int OrderId
    Order Order
    decimal TourPriceSnapshot  // Tour.TotalPrice на момент заказа (AMD)
    decimal TotalAmount        // согласованная сумма заказа (AMD)
    decimal PrepaidAmount      // предоплата, число; сейчас вычисляется как 0 (без шлюза)
    string Currency            // ISO-4217, default "AMD"
```

**`ClosureRule.cs`**
```
[EntityTypeConfiguration(typeof(ClosureRuleConfiguration))]
ClosureRule : EntityBase
    int? TourId                // null = глобально (все туры); set = конкретный тур
    Tour Tour
    ClosureRuleType Type       // SpecificDate | Weekly
    ClosureAction Action       // Close | Open (Open = исключение-переоткрытие)
    DateOnly? Date             // заполнено при Type == SpecificDate
    DayOfWeek? DayOfWeek       // System.DayOfWeek, заполнено при Type == Weekly (хранится int)
    DateOnly? EffectiveFrom    // необяз. нижняя граница для Weekly (включительно)
    DateOnly? EffectiveTo      // необяз. верхняя граница для Weekly (включительно)
    string Reason              // необяз. внутренняя заметка админа
```

`Tour` дополняется навигацией **не** нужно (обратные коллекции `Orders`/`ClosureRules` в `Tour`
не заводим — они не читаются графом тура; FK-стороны достаточно, как у `Place.RegionId`).

### 2.2 Enums — `ATTours.Common/Enums/` (создать)

**`OrderStatus.cs`**
```
OrderStatus
    PendingConfirmation = 1   // ждёт ручного подтверждения (задел, сейчас не выставляется)
    Confirmed = 2            // подтверждён (сейчас — сразу при создании, авто)
    Cancelled = 3
```
Расширяемость (требование задачи): статус-переход НЕ хардкодит «всегда авто». Начальный
статус выбирается в `OrderCreationService` (см. 4.1) — сейчас всегда `Confirmed`. Будущий
per-product флаг (например `Tour.RequiresManualConfirmation`) и админский переход
`PendingConfirmation → Confirmed` добавляются без изменения схемы: enum уже несёт оба состояния.
**Флаг на туре и confirm-эндпоинт — вне скоупа этой задачи** (см. §8).

**`ClosureRuleType.cs`**
```
ClosureRuleType
    SpecificDate = 1
    Weekly = 2
```

**`ClosureAction.cs`**
```
ClosureAction
    Close = 1
    Open = 2
```

`DayOfWeek` — системный `System.DayOfWeek` (Sunday=0..Saturday=6), свой enum не заводить.

### 2.3 EF-конфигурации — `ATTours.Common/Infrastructure/EntityConfiguration/` (создать)

**`OrderConfiguration.cs`**
- `ToTable(nameof(Order))`.
- `HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict)`.
- `HasOne(x => x.Tour).WithMany().HasForeignKey(x => x.TourId).OnDelete(DeleteBehavior.Restrict)`.
- `HasOne(x => x.Payment).WithOne(p => p.Order).HasForeignKey<OrderPayment>(p => p.OrderId).OnDelete(DeleteBehavior.Cascade)`.
- `Property(x => x.TourDate)` — тип `date` подхватится автоматически из `DateOnly`.
- Индексы: `HasIndex(x => x.TourDate)`, `HasIndex(x => new { x.TourId, x.TourDate })`,
  `HasIndex(x => x.UserId)`, `HasIndex(x => x.Status)`.

`Restrict` на обоих FK намеренно: заказ нельзя осиротить при удалении тура/пользователя.
Пользователь и так soft-delete (`User.IsDeleted`); тур с заказами блокируется на hard-delete
(см. 4.4).

**`OrderPaymentConfiguration.cs`**
- `ToTable(nameof(OrderPayment))`.
- `Property(TourPriceSnapshot).HasPrecision(18, 2)`; то же для `TotalAmount`, `PrepaidAmount`.
- `Property(Currency).IsRequired().HasMaxLength(3)`.
- `HasIndex(p => p.OrderId).IsUnique()` (гарантия 1:1).
- Обратную связь настраивает `OrderConfiguration` (выше) — здесь не дублировать.

**`ClosureRuleConfiguration.cs`**
- `ToTable(nameof(ClosureRule))`.
- `HasOne(x => x.Tour).WithMany().HasForeignKey(x => x.TourId).OnDelete(DeleteBehavior.Cascade)`
  (FK nullable → удаление тура снимает его правила; глобальные с `TourId == null` не трогаются).
- `Property(x => x.Reason).HasMaxLength(500)` (nullable).
- Индексы: `HasIndex(x => new { x.TourId, x.Type })`, `HasIndex(x => x.Date)`,
  `HasIndex(x => x.DayOfWeek)`.

### 2.4 DTO — `ATTours.Common/DTO/` (создать)

**`Init/OrderCreateModel.cs`** (без `Id`, без `UserId`, без денег/статуса — всё server-side)
```
int TourId
DateOnly TourDate
int GuestCount
```

**`Info/OrderInfoModel.cs`**
```
int Id
int UserId
string UserEmail            // денормализовано для админского списка
string UserFullName         // FirstName + LastName
int TourId
string TourTitle            // резолвится по languageCode в info-сервисе (см. 4.1); в GetAll — RU
string TourMainImageUrl
DateOnly TourDate
int GuestCount
OrderStatus Status
DateTime CreatedAtUtc
OrderPaymentInfoModel Payment
```

**`Info/OrderPaymentInfoModel.cs`**
```
decimal TourPriceSnapshot
decimal TotalAmount
decimal PrepaidAmount
string Currency
```

**`Init/ClosureRuleCreateModel.cs`** (используется и на bulk-create списком)
```
int? TourId
ClosureRuleType Type
ClosureAction Action
DateOnly? Date
DayOfWeek? DayOfWeek
DateOnly? EffectiveFrom
DateOnly? EffectiveTo
string Reason
```

**`Info/ClosureRuleInfoModel.cs`**
```
int Id
int? TourId
ClosureRuleType Type
ClosureAction Action
DateOnly? Date
DayOfWeek? DayOfWeek
DateOnly? EffectiveFrom
DateOnly? EffectiveTo
string Reason
```

**`Info/CalendarMonthModel.cs`** (кормит админ-календарь; строит сервис, не маппер)
```
int Year
int Month
List<CalendarDayModel> Days
```
**`Info/CalendarDayModel.cs`**
```
DateOnly Date
bool IsClosedGlobally               // глобальное закрытие действует на этот день
List<int> ClosedTourIds             // туры, закрытые именно в этот день (tour-scope)
int TotalOrders                     // сумма по OrdersByTour
List<CalendarDayTourOrdersModel> OrdersByTour
```
**`Info/CalendarDayTourOrdersModel.cs`**
```
int TourId
int OrderCount
int GuestCount                      // суммарное число гостей по этому туру в этот день
```

Счётчики календаря учитывают заказы со `Status != Cancelled` (Cancelled в занятость не идут).

DTO календаря сложены в `DTO/Info/` рядом с прочими Info-моделями (в проекте нет отдельной
папки под read-model, `SiteSettingsPublicModel` лежит там же).

---

## 3. `ATTours.DataLayer` — контекст и миграция

### 3.1 `ATToursContext.cs` (изменить)
Добавить три `DbSet`:
```
public DbSet<Order> Orders { get; set; }
public DbSet<OrderPayment> OrderPayments { get; set; }
public DbSet<ClosureRule> ClosureRules { get; set; }
```

### 3.2 Миграция `AddOrdersAndClosureRules` (создать)
Три таблицы + индексы из §2.3. Без `HasData`, без данных. `Down()` — drop трёх таблиц.
`DateOnly` → колонка `date`. Накат — вручную, после «go» Давида.

---

## 4. `ATTours.Service` (`ATTours.BusinessServices`) — сервисы

Namespace слоя — `ATTours.BusinessServices.*`.

### 4.1 Заказы

**`Services/CreateServices/OrderCreationService.cs`** (создать)
```csharp
public class OrderCreationService : CreateVerifiableEntityBase<Order, ATToursContextFactory>
{
    public OrderCreationService(Order entity, int userId, CancellationToken ct = default)
        : base(entity, CommonSettings.Instance.ATToursConnectionString, ct);
    public OrderCreationService(Order entity, int userId, IApplicationDbContext context, CancellationToken ct = default)
        : base(entity, context, ct);

    protected override IEntityValidation GetEntityValidation()
        => new OrderValidationService(Entities, Context);

    // Обогащение ДО валидации и сохранения: снапшот цены, статус, платёж, даты.
    protected override async Task ExecuteEntityChangesFactoryAsync()
    {
        await EnrichAsync();            // см. ниже
        await base.ExecuteEntityChangesFactoryAsync();  // validate() + AddRange()
    }
}
```
`EnrichAsync` (доменная логика заказа — здесь, не в контроллере/маппере):
1. `entity.UserId = _userId` (значение из токена, переданное контроллером).
2. Загрузить `Tour` по `entity.TourId` (`Context.Set<Tour>()`); если нет — валидация ниже
   отобьёт, но снапшот берём тут: `snapshot = tour.TotalPrice ?? 0`.
3. `entity.CreatedAtUtc = DateTime.UtcNow`.
4. `entity.Status = OrderStatus.Confirmed;` — **единственное место выбора начального статуса**
   (сейчас всегда авто; будущий per-product review подключается здесь, см. §8).
5. `entity.Payment = new OrderPayment { TourPriceSnapshot = snapshot,
   TotalAmount = snapshot * entity.GuestCount, PrepaidAmount = ResolvePrepayment(...),
   Currency = "AMD" }`. `ResolvePrepayment` сейчас возвращает `0m` — seam под будущую политику
   предоплаты (ADR 014).

**`Services/ValidationServices/OrderValidationService.cs`** (создать)
```csharp
internal class OrderValidationService : EntityValidationContextDependentBase<Order, ATToursContextFactory>
{
    public OrderValidationService(List<Order> entities, IApplicationDbContext context);
    public override async Task ValidateEntitiesAsync();
}
```
Правила (throw `ErrorModelException` с кодами из §7):
- `GuestCount >= 1`, иначе `InvalidGuestCount` (400).
- `TourDate >= DateOnly.FromDateTime(DateTime.UtcNow)`, иначе `OrderDateInPast` (400).
- Тур существует и публичен (`IsActive && !IsArchived`), иначе `TourNotFound` (400/404).
- День не закрыт: загрузить применимые `ClosureRule` (глобальные + по `TourId`), позвать
  `ClosureRuleResolver.IsClosed(rules, TourDate, TourId)`; если закрыто → `TourDateUnavailable`
  (400). **Это и есть серверная блокировка брони на закрытую дату.**

**`Services/InfoServices/OrderInfo.cs`** (создать) — по образцу `TourInfo`/`PlaceInfo`.
```csharp
public class OrderInfo : EntityInfoBase<Order>
{
    public OrderInfo();
    public OrderInfo(string connectionString, CancellationToken ct = default);
    public OrderInfo(IApplicationDbContext context, CancellationToken ct = default);

    protected override IEntityQueryableRepository<Order> GetEntityQueryableRepository();
    //   base + .Include(o => o.Payment) + .Include(o => o.User) + .Include(o => o.Tour).ThenInclude(t => t.Translations)

    public Task<List<Order>> GetByUserAsync(int userId);          // Where(o => o.UserId == userId)
    public Task<Order> GetByIdAsync(int id);
}
```
Резолв `TourTitle`/`UserFullName`/`UserEmail` в `OrderInfoModel` — в мапере (`AfterMap`)
и/или пост-обработкой языка (`LanguageExtensions`) на уровне контроллера, как в `PlaceController`.
Для `GetAll` (админ) отдаём RU-заголовок тура; для `GetMine` контроллер принимает `languageCode`
и извлекает нужный перевод (`ExtractWithNeededLanguage`).

**`Services/UpdateServices/OrderCancellationService.cs`** (создать) — по образцу
`TourActivationService` (`RepositoryCoreBase<Order, ATToursContextFactory>`):
```csharp
public Task CancelAsync(int id);   // грузит заказ, Status = Cancelled, SaveChangesAsync;
                                   // нет заказа → OrderNotFound (404)
```
Проверку владельца (свой/чужой заказ) делает **контроллер** (у него есть `User.GetUserId()`
и роль), сервис — только смена статуса.

**`Services/InfoServices/OrderCalendarInfo.cs`** (создать) — read-model, НЕ наследует
`EntityInfoBase` (как `SiteSettingsInfo` отходит от паттерна ради слияния). Базируется на
`RepositoryCoreBase<Order, ATToursContextFactory>`:
```csharp
public Task<CalendarMonthModel> GetMonthAsync(int year, int month);
```
Логика:
1. Границы месяца `[first, last]` в `DateOnly`.
2. Заказы: `Context.Set<Order>().Where(o => o.Status != Cancelled && o.TourDate in [first,last])`
   → `GroupBy(o => new { o.TourDate, o.TourId })` в SQL → счётчики `OrderCount`, `Sum(GuestCount)`.
3. Правила: загрузить `ClosureRule`, применимые к месяцу (глобальные + любые tour-scope; Weekly
   без границ или пересекающие месяц; SpecificDate внутри месяца).
4. По каждому дню месяца собрать `CalendarDayModel`: `IsClosedGlobally` =
   `ClosureRuleResolver.IsClosed(globalRules, day, tourId: null)`; `ClosedTourIds` —
   туры, для которых `IsClosed(rules, day, tourId) == true`, но глобально день открыт
   (перечисляем только те `TourId`, что реально фигурируют в tour-scope правилах месяца, чтобы
   не итерировать по всем турам БД). `OrdersByTour` — из шага 2.

### 4.2 Правила закрытия

**`Services/Availability/ClosureRuleResolver.cs`** (создать) — **чистая функция, без БД**;
здесь живёт бизнес-правило precedence (граница слоёв: правило — в Service, не в репозитории).
```csharp
public static class ClosureRuleResolver
{
    // true = день закрыт для брони этого тура (или глобально, если tourId == null).
    public static bool IsClosed(IEnumerable<ClosureRule> rules, DateOnly date, int? tourId);
}
```
Алгоритм (полностью по ADR 012): среди `rules` отобрать применимые к `date` и области
(`rule.TourId == null` — глобальное; `rule.TourId == tourId` — по туру), где для `Weekly`
совпадает `DayOfWeek` и `date` в `[EffectiveFrom, EffectiveTo]` (границы включительны, null =
без границы). Из применимых выбрать по убыванию специфичности:
`Tour+SpecificDate > Global+SpecificDate > Tour+Weekly > Global+Weekly`. Победитель:
`Action == Open` → `false`; `Action == Close` → `true`. Нет применимых → `false`.

**`Services/InfoServices/ClosureRuleInfo.cs`** (создать) — по образцу `PlaceInfo`:
```csharp
public class ClosureRuleInfo : EntityInfoBase<ClosureRule>
{
    public ClosureRuleInfo(); / (connectionString, ct); / (context, ct);

    // Публичный booking-card: плоский список закрытых дат тура в диапазоне (глобальные + tour).
    // Материализация — в ответе, не в БД (ADR 012). Итерирует дни [from, to], зовёт резолвер.
    public Task<List<DateOnly>> GetClosedDatesAsync(int tourId, DateOnly from, DateOnly to);
}
```

**`Services/CreateServices/ClosureRuleCreationService.cs`** (создать) —
`CreateVerifiableEntityBase<ClosureRule, ATToursContextFactory>`, конструктор со `List<ClosureRule>`
(bulk-close). Валидация — `ClosureRuleValidationService`.

**`Services/ValidationServices/ClosureRuleValidationService.cs`** (создать) —
`EntityValidationContextDependentBase<ClosureRule, ATToursContextFactory>`. Правила →
`InvalidClosureRule` (400):
- `Type == SpecificDate` ⇒ `Date != null` и `DayOfWeek == null`.
- `Type == Weekly` ⇒ `DayOfWeek != null` и `Date == null`.
- Если обе границы заданы: `EffectiveFrom <= EffectiveTo`.
- Если `TourId != null` — тур существует (`Context.Set<Tour>().AnyAsync`), иначе `TourNotFound`.

**`Services/DeleteServices/ClosureRuleDeletionService.cs`** (создать) — по образцу
`PlaceDeletionService`:
```csharp
public Task DeleteAsync(int id);          // нет строки → InvalidClosureRule/RelationalEntityNotFound (404)
```

### 4.3 `TourGraphQueryExtensions` / `TourUpdateService`
**Не трогаются.** Обратных навигаций в `Tour` нет, граф тура не расширяется.

### 4.4 `TourDeletionService.cs` (изменить)
Перед hard-delete тура проверить наличие заказов:
`if (await Context.Set<Order>().AnyAsync(o => o.TourId == id)) throw ErrorModelException(TourHasOrders, 400, ...)`.
Причина: FK `Order.TourId` = `Restrict`, без явной проверки удаление упало бы сырой SQL-ошибкой
через `MsSqlContextExceptionHandlerChain` вместо внятного кода (тот же приём, что
`CatalogEntryInUse` у каталогов). `ClosureRule` тура удаляется каскадом — её проверять не надо.

---

## 5. `ATTours.ClientAPI` — контроллеры и маппер

### 5.1 `Controllers/OrderController.cs` (создать)
Стиль `PlaceController` (`OrderController(IMapper mapper) : Controller`, `api/Order`, сервисы
через `new` + `using`). Роли — через `ApiRoles` (см. 5.3).

| Метод | Route | Auth | Вход | Возврат | Примечание |
| --- | --- | --- | --- | --- | --- |
| POST | `api/Order/Create` | `[Authorize]` | `OrderCreateModel` | `OrderInfoModel` | `UserId = User.GetUserId()`, НЕ из тела. Map model→`Order`, `new OrderCreationService(entity, userId)`, затем перечитать через `OrderInfo.GetByIdAsync` |
| GET | `api/Order/GetMine` | `[Authorize]` | `languageCode` | `List<OrderInfoModel>` | `OrderInfo.GetByUserAsync(User.GetUserId())`; заголовок тура — по языку |
| GET | `api/Order/GetAll` | `[Authorize(Roles = ApiRoles.Admin)]` | `tourId?`, `from?`, `to?`, `status?` | `List<OrderInfoModel>` | админский список; фильтры опциональны, заголовок тура — RU |
| PATCH | `api/Order/Cancel` | `[Authorize]` | `id` | — | Загрузить заказ; если `order.UserId != User.GetUserId()` И роль не Admin → `OrderAccessForbidden` (403). Иначе `OrderCancellationService.CancelAsync(id)` |

### 5.2 `Controllers/AvailabilityController.cs` (создать)
`AvailabilityController(IMapper mapper) : Controller`, `api/Availability`.

| Метод | Route | Auth | Вход | Возврат |
| --- | --- | --- | --- | --- |
| GET | `api/Availability/GetCalendar` | `[Authorize(Roles = ApiRoles.Admin)]` | `year`, `month` | `CalendarMonthModel` (`OrderCalendarInfo.GetMonthAsync`) |
| GET | `api/Availability/GetRules` | `[Authorize(Roles = ApiRoles.Admin)]` | `tourId?` | `List<ClosureRuleInfoModel>` (`ClosureRuleInfo.GetAllAsync`, опц. фильтр по туру + глобальные) |
| POST | `api/Availability/CreateRules` | `[Authorize(Roles = ApiRoles.Admin)]` | `List<ClosureRuleCreateModel>` | `List<ClosureRuleInfoModel>` (bulk-close/open, перечитать созданные) |
| DELETE | `api/Availability/DeleteRule` | `[Authorize(Roles = ApiRoles.Admin)]` | `id` | — (`ClosureRuleDeletionService`) |
| GET | `api/Availability/GetClosedDates` | публично (без `[Authorize]`) | `tourId`, `from`, `to` | `List<DateOnly>` (`ClosureRuleInfo.GetClosedDatesAsync`) — для гашения дней в booking-card |

`GetClosedDates` публичный намеренно (booking-card на публичном сайте), как `GetForClient`
у `PlaceController` — отдаёт только даты, ничего чувствительного.

### 5.3 `Authorization/ApiRoles.cs` (изменить)
Добавить набор для клиентских (любой залогиненный) действий не требуется — `[Authorize]` без
ролей достаточно. `ApiRoles.Admin` уже есть; новых констант не нужно, если создание заказа
открыто всем аутентифицированным (роль `Regular` включительно — задача: гостевой брони нет,
но любой залогиненный может заказать). **Изменение файла не требуется** — оставить как есть.

### 5.4 `Mapper/MappingProfile.cs` (изменить)
Добавить блоки:
- `OrderCreateModel → Order` — только `TourId`, `TourDate`, `GuestCount`;
  `Ignore()` для `UserId`, `Status`, `CreatedAtUtc`, `Payment`, `User`, `Tour` (их ставит сервис).
- `Order → OrderInfoModel` — `AfterMap`: `UserEmail`/`UserFullName` из `src.User`,
  `TourTitle`/`TourMainImageUrl` из `src.Tour` (title — из `Tour.Translations`, резолв языка
  делает контроллер/`LanguageExtensions`, в `GetAll` — RU через `TourTranslationType.Title`).
- `OrderPayment → OrderPaymentInfoModel`.
- `ClosureRuleCreateModel → ClosureRule` и `ClosureRule → ClosureRuleInfoModel` (плоско, 1:1).
- Календарные модели (`CalendarMonthModel` и вложенные) строит `OrderCalendarInfo`, маппер их
  **не** трогает.

`DateOnly` на проводе сериализуется System.Text.Json как `"2026-08-25"` (поддержка с .NET 7) —
отдельная настройка не нужна.

---

## 6. `ATTours.Helper` / `ATTours.ContextRepository`
**Изменений нет.** Новые цепочки `IExceptionHandler`/`ExceptionHandlerChainBase` НЕ заводятся —
`ErrorModelExceptionHandlerChain` покрывает все новые коды (как в §3.x архитектуры этапа 3).
Репозиторные абстракции достаточны (`EntityRepository<T>`, `IEntityQueryableRepository<T>`,
`RepositoryCoreBase`) — конкретных репозиториев не создавать.

---

## 7. Новые коды ошибок — `ATTours.Helper/Enums/GlobalErrorCode.cs` (изменить)
Регион `EntityErrors`, продолжая после `2012`:
```
OrderNotFound        = 2013   // 404
TourDateUnavailable  = 2014   // 400, дата закрыта резолвером
InvalidGuestCount    = 2015   // 400
OrderDateInPast      = 2016   // 400
InvalidClosureRule   = 2017   // 400, некорректная форма правила
TourHasOrders        = 2018   // 400, hard-delete тура с заказами
OrderAccessForbidden = 2019   // 403, чужой заказ (не владелец и не админ)
```

---

## 8. Явно ВНЕ скоупа этой задачи
- **Реальная платёжная интеграция** (шлюз, статусы транзакций, поля провайдера) — `OrderPayment`
  только оставляет под неё чистую точку расширения (ADR 014). Сейчас `PrepaidAmount == 0`.
- **Per-product ручное подтверждение**: флаг на туре (`Tour.RequiresManualConfirmation`),
  выбор `PendingConfirmation` при создании и админский переход `→ Confirmed`. Enum `OrderStatus`
  и точка выбора статуса в `OrderCreationService` уже готовы это принять без миграции; сам
  флаг и confirm-эндпоинт добавит будущая волна по решению Давида.
- **Окно бронирования (3 месяца вперёд)** — остаётся фронтовым лимитом; бэкенд его НЕ проверяет
  (задача этого не требует). Бэкенд отбивает только прошедшие даты и закрытые дни.
- **Редактирование существующего `ClosureRule`** (PUT) — не нужно: правила дёшевы, изменение =
  удалить + создать. Только Create (bulk) и Delete.
- **Обратные навигации `Tour.Orders` / `Tour.ClosureRules`** — не заводятся (не читаются графом).
- **Сам админ-календарь (UI) и booking-card wiring** — зона `frontend-architect`; здесь только
  серверный контракт, который их кормит.
- **Мультиязычность заказов/правил** — не применяется (§1).

---

## 9. Чек-лист для `backend-developer` (порядок реализации)
1. Enums: `OrderStatus`, `ClosureRuleType`, `ClosureAction`.
2. Entities: `Order`, `OrderPayment`, `ClosureRule` (+ атрибуты конфигурации).
3. EF-конфигурации: `OrderConfiguration`, `OrderPaymentConfiguration`, `ClosureRuleConfiguration`.
4. `ATToursContext` — три `DbSet`.
5. Миграция `AddOrdersAndClosureRules` (не накатывать без «go»).
6. DTO: Init (`OrderCreateModel`, `ClosureRuleCreateModel`), Info (`OrderInfoModel`,
   `OrderPaymentInfoModel`, `ClosureRuleInfoModel`, `CalendarMonthModel`, `CalendarDayModel`,
   `CalendarDayTourOrdersModel`).
7. `ClosureRuleResolver` (чистая функция) + юнит-покрытие precedence (для `backend-tester`).
8. Сервисы заказа: `OrderValidationService`, `OrderCreationService`, `OrderInfo`,
   `OrderCancellationService`, `OrderCalendarInfo`.
9. Сервисы закрытий: `ClosureRuleValidationService`, `ClosureRuleCreationService`,
   `ClosureRuleInfo`, `ClosureRuleDeletionService`.
10. `TourDeletionService` — проверка `TourHasOrders`.
11. Коды ошибок в `GlobalErrorCode`.
12. Маппер-блоки в `MappingProfile`.
13. Контроллеры `OrderController`, `AvailabilityController`.
14. Сборка решения, прогон через `backend-tester` (Swagger/.http), затем `update-docs`
    (`backend-api.md` + `CHANGELOG.md`).
