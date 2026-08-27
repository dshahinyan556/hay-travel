# Архитектура: роль исполнителя + снятие исполнителя + настройки уведомлений

> **2026-08-23: ЧАСТИЧНО ЗАМЕНЕНО.** Один исполнитель на строку (D.4-D.6), зашитые в код
> получатели и RU-only шаблоны (E.1-E.11) — заменены мульти-исполнительской моделью и
> настраиваемыми получателями, см. `architecture-notification-recipients-multi-employee.md`
> §0.1 (таблица переопределений) и `backend-api.md`. `EmployeeJobRole`/`User.DefaultJobRole`
> (D.1-D.3), allow-list санитайзера и синтаксис плейсхолдеров (E.4-E.5) — в силе без изменений.

Проектный документ для backend-developer. Покрывает **Задачу D** (роль исполнителя
Водитель/Гид/Гид-водитель + снятие исполнителя) и **Задачу E** (настройки уведомлений
вкл/выкл на действие + WYSIWYG-шаблоны писем). Источник требований —
`checklist-order-lock-role-notifications.txt`, разделы «ЗАДАЧА D» и «ЗАДАЧА E».

Реализовывать строго по этому документу. Дополнительных архитектурных решений принимать
не нужно — всё, что было «на усмотрение», решено здесь. Реализацию писать по образцу уже
существующего вертикального среза заказов (`Order`/`OrderLine`/`OrderAssignEmployeeService`/
`OrderController`) и настроек (`SiteSetting`/`SiteSettingsUpdateService`).

Язык писем во всём документе — русский (весь текущий `EmailMessageFactory` — RU). Мультиязычные
шаблоны писем — **вне скоупа** (см. §E.9).

---

## ЧАСТЬ D — Роль исполнителя и снятие исполнителя

### D.1. Новый enum роли-работы `EmployeeJobRole`

Файл: `ATTours.Common/Enums/EmployeeJobRole.cs` — **создать**.

```
public enum EmployeeJobRole
{
    Driver = 1,       // Водитель
    Guide = 2,        // Гид
    DriverGuide = 3   // Гид-водитель
}
```

Это **отдельный enum**, не пересекается с аккаунтным `RoleType` (Regular/TourManager/Admin/
Employee). `RoleType` — права доступа к API; `EmployeeJobRole` — рабочая специализация
сотрудника на конкретной брони. Смешивать их нельзя.

Хранение — `int` (как `RoleType` в `UserRole.Type`). В БД лежит числом, наружу уходит числом
(фронт мапит на подписи сам, как уже делает с `OrderStatus`/`RoleType`).

Русские подписи нужны бэкенду только для подстановки в письмо (`{{EmployeeRole}}`, §E.6).
Завести extension:

Файл: `ATTours.Common/Extensions/EmployeeJobRoleExtensions.cs` — **создать**.
- `public static string ToRussianLabel(this EmployeeJobRole role)` →
  `Driver → "Водитель"`, `Guide → "Гид"`, `DriverGuide → "Гид-водитель"`.

### D.2. Роль-по-умолчанию на профиле сотрудника (`User`)

Файл: `ATTours.Common/Entities/User.cs` — **изменить**. Добавить:
```
// Рабочая специализация сотрудника по умолчанию (Задача D). Nullable: профиль может
// существовать без заданной роли — тогда в попапе назначения дефолта нет, но выбор роли
// там всё равно обязателен. Снапшот на строке заказа (OrderLine.EmployeeRole) не зависит
// от этого поля — это лишь дефолт для попапа.
public EmployeeJobRole? DefaultJobRole { get; set; }
```

**Решение (открытый вопрос из чек-листа): роль-по-умолчанию в профиле НЕ обязательна.**
Обоснование:
- `RoleType.Employee` уже назначается сотрудникам сейчас, до появления понятия job-role.
  Сделав `DefaultJobRole` обязательным, пришлось бы принимать решение по миграции данных для
  уже существующих сотрудников (какую роль им проставить) — искусственно.
- Поле — только удобный дефолт для попапа назначения. Настоящий гейт («нельзя назначить без
  роли») стоит на самом назначении (D.4), а не на профиле.
- Значит: профиль может быть без роли; при назначении, если дефолта нет — попап открывается с
  пустым Select, но сохранить назначение без выбора нельзя.

Конфигурация: `UserConfiguration` — отдельной настройки для `DefaultJobRole` не требуется
(nullable int по конвенции EF). Ничего в `UserConfiguration.cs` дописывать не нужно, кроме
проверки, что новое поле попадает в модель (оно попадёт автоматически).

DTO наружу — добавить поле в обе проекции пользователя:
- `ATTours.Common/DTO/Auth/UserInfoModel.cs` — **изменить**: `public EmployeeJobRole? DefaultJobRole { get; set; }`
  (нужно списку сотрудников, чтобы попап назначения знал дефолт).
- `ATTours.Common/DTO/Auth/UserDetailInfoModel.cs` — **изменить**: то же поле (нужно карточке
  сотрудника, чтобы показать/редактировать роль).

AutoMapper: `User → UserInfoModel` и `User → UserDetailInfoModel` мапят одноимённое поле
автоматически. Явных `ForMember` не требуется (проверить, что оба маппинга не `Ignore()`-ят
незнакомые поля).

### D.3. Эндпоинт установки роли-по-умолчанию в профиле

Профилем сотрудника управляет админ через `UsersController` (он весь `[Authorize(Roles=Admin)]`).

Файл: `ATTours.Common/DTO/Request/SetUserJobRoleModel.cs` — **создать**.
```
public class SetUserJobRoleModel
{
    public int UserId { get; set; }
    public EmployeeJobRole? JobRole { get; set; } // null допустим — «снять роль по умолчанию»
}
```

Файл: `ATTours.Service/Services/UpdateServices/UserJobRoleUpdateService.cs` — **создать**.
Образец — `UserPhoneUpdateService` (точечная правка одного скалярного поля одной строки).
Контракт:
```
public class UserJobRoleUpdateService : RepositoryCoreBase<User, ATToursContextFactory>
{
    public Task<User> UpdateJobRoleAsync(int userId, EmployeeJobRole? jobRole);
}
```
Логика: `Include(x => x.Role)` (контроллер вернёт `UserInfoModel`, маппинг читает `Role.Type`),
`!IsDeleted`, иначе `RelationalEntityNotFound`/404. Проставить `user.DefaultJobRole = jobRole`,
`SaveChanges`, вернуть `user`. Никаких ролевых guard'ов внутри — доступ уже ограничен
контроллером. Проверять `RoleType.Employee` НЕ обязательно (дефолт можно проставить заранее,
до выдачи роли Employee — это не ломает инвариант; но если хочется симметрии с назначением —
допустимо кинуть `UserIsNotEmployee`, оставляю на минимализм: **не проверять**).

Файл: `ATTours.ClientAPI/Controllers/UsersController.cs` — **изменить**. Добавить:
```
[HttpPatch]
[Route("SetJobRole")]
public async Task<UserInfoModel> SetJobRoleAsync([FromBody] SetUserJobRoleModel model, CancellationToken ct)
```
По образцу `ChangeRoleAsync`: `new UserJobRoleUpdateService(ct)` → `UpdateJobRoleAsync` →
`mapper.Map<UserInfoModel>(user)`.

### D.4. Снапшот роли на `OrderLine` + обязательность при назначении

Файл: `ATTours.Common/Entities/OrderLine.cs` — **изменить**. Рядом с `EmployeeId` добавить:
```
// Снапшот рабочей роли исполнителя на момент назначения (Задача D). Nullable и живёт
// строго синхронно с EmployeeId: оба null — строка не назначена; оба заполнены — назначена.
// Это снапшот, а не FK на User.DefaultJobRole — роль в попапе можно переопределить.
public EmployeeJobRole? EmployeeRole { get; set; }
```

**Инвариант (обеспечивает сервис, не БД):** `EmployeeId` и `EmployeeRole` всегда меняются
вместе. Назначение — оба заданы; снятие — оба в null. Промежуточных состояний
(есть сотрудник без роли / роль без сотрудника) быть не должно.

Конфигурация: `OrderLineConfiguration.cs` — отдельной настройки не требуется (nullable int).
Индекс не нужен (по роли не фильтруем).

DTO: `ATTours.Common/DTO/Info/OrderLineInfoModel.cs` — **изменить**. Рядом с `EmployeeFullName`:
```
public EmployeeJobRole? EmployeeRole { get; set; }
```
Маппинг `OrderLine → OrderLineInfoModel` мапит `EmployeeRole` автоматически (одноимённое поле).
`ApplyOrderLineDenormalizedFields` править НЕ нужно — роль это скаляр, не денормализация.
Проверить только, что маппинг не `Ignore()`-ит `EmployeeRole`.

### D.5. Контракт `AssignEmployee` — обязательная роль

Файл: `ATTours.Common/DTO/Request/OrderAssignEmployeeModel.cs` — **изменить**. Добавить
обязательное поле роли:
```
public EmployeeJobRole EmployeeRole { get; set; }   // обязательно, non-nullable
```
`SendEmail` **остаётся** (не удалять) — см. согласование с Задачей E в §E.8. Итоговая модель:
`OrderId`, `EmployeeId`, `EmployeeRole` (новое, обязательное), `LineId?`, `SendEmail = true`.

Файл: `ATTours.Service/Services/UpdateServices/OrderAssignEmployeeService.cs` — **изменить**.
- В `AssignAsync`: проставлять `line.EmployeeRole = model.EmployeeRole` рядом с
  `line.EmployeeId = model.EmployeeId` в цикле по `targets`.
- Валидация: `EmployeeRole` — non-nullable enum, приедет как минимум `0` при отсутствии.
  Отвергать значение вне диапазона enum: если `!Enum.IsDefined(typeof(EmployeeJobRole), model.EmployeeRole)`
  → `ErrorModelException(GlobalErrorCode.EmployeeRoleRequired, HttpStatusCode.BadRequest)`
  (новый код, см. D.7). Это и есть гейт «нельзя назначить без роли» (0 не входит в enum,
  значения начинаются с 1).
- В `OrderAssignEmployeeResult` **добавить** `public EmployeeJobRole EmployeeRole { get; set; }`
  (нужно письму назначения — плейсхолдер `{{EmployeeRole}}`, §E.6). Заполнять из `model.EmployeeRole`.

### D.6. Снятие исполнителя — **отдельный эндпоинт** `UnassignEmployee`

**Решение (открытый вопрос из чек-листа): отдельный эндпоинт, НЕ переиспользование
`AssignEmployee` с nullable id/role.** Обоснование:
- `AssignEmployee` держит `EmployeeId` non-nullable и `EmployeeRole` обязательным (гейт D.5).
  Сделать их nullable ради снятия — размыть инвариант «назначение всегда с ролью» и заставить
  каждый вызов различать назначение/снятие по null внутри одной модели.
- Существующая bulk-семантика `LineId == null` = «на все строки» переиспользуется как есть:
  снятие тоже поддерживает «снять со всех строк» (`LineId == null`) и «снять с одной»
  (`LineId` задан) — единообразно с назначением.

Файл: `ATTours.Common/DTO/Request/OrderUnassignEmployeeModel.cs` — **создать**.
```
public class OrderUnassignEmployeeModel
{
    public int OrderId { get; set; }
    public int? LineId { get; set; }  // null = снять со всех строк заказа (та же семантика, что в Assign)
}
```
`SendEmail`-флага здесь **нет** (см. §E.8: отправку письма о снятии решает только тумблер
шаблона `order.unassign_employee`, отдельного «тихого снятия» в UX не предусмотрено).

Файл: `ATTours.Service/Services/UpdateServices/OrderUnassignEmployeeService.cs` — **создать**.
Образец — `OrderAssignEmployeeService`. Контракт:
```
public class OrderUnassignEmployeeService : RepositoryCoreBase<Order, ATToursContextFactory>
{
    public Task<OrderUnassignEmployeeResult> UnassignAsync(OrderUnassignEmployeeModel model);
}

public class OrderUnassignEmployeeResult
{
    public List<int> UnassignedLineIds { get; set; } = [];
    // Данные СНЯТОГО сотрудника — захватить ДО обнуления, для письма о снятии.
    // Если разные строки были назначены на разных сотрудников (bulk), см. примечание ниже.
    public string EmployeeEmail { get; set; }
    public string EmployeeFullName { get; set; }
    public EmployeeJobRole? EmployeeRole { get; set; }
}
```
Логика:
1. Загрузить `order` с `Include(x => x.Lines).ThenInclude(l => l.Employee)`; нет — `OrderNotFound`.
2. `targets` = все строки или одна по `LineId` (та же логика, что в Assign; если `LineId`
   задан и строки нет — `OrderLineNotFound`).
3. Из `targets` взять только реально назначенные (`EmployeeId != null`). Если таких нет —
   вернуть результат с пустым `UnassignedLineIds` (не ошибка: снятие уже-снятого идемпотентно).
4. Захватить данные сотрудника для письма. **Bulk-примечание:** при `LineId == null` строки
   теоретически могли быть назначены на разных людей. Правило: письмо о снятии шлём по
   **уникальным снятым сотрудникам** — сервис возвращает не одного, а список.
   Уточнённая форма результата:
   ```
   public List<UnassignedEmployee> Unassigned { get; set; } = [];
   // UnassignedEmployee { Email, FullName, EmployeeRole, List<int> LineIds }
   ```
   Контроллер шлёт по одному письму на каждого `UnassignedEmployee` (в подавляющем большинстве
   случаев это ровно один человек — мульти-исполнительские заказы редкость). Заменяет плоские
   `EmployeeEmail/FullName/Role` выше — используй именно списочную форму.
5. Обнулить на каждой снятой строке `line.EmployeeId = null; line.EmployeeRole = null;`
   `SaveChanges`.

Файл: `ATTours.ClientAPI/Controllers/OrderController.cs` — **изменить**. Добавить эндпоинт
по образцу `AssignEmployeeAsync`:
```
[HttpPatch]
[Route("UnassignEmployee")]
[Authorize(Roles = ApiRoles.Admin)]
public async Task UnassignEmployeeAsync([FromBody] OrderUnassignEmployeeModel model, CancellationToken ct)
```
Поток:
1. `new OrderUnassignEmployeeService(ct).UnassignAsync(model)`.
2. Если сняты строки — по каждому `UnassignedEmployee` вызвать
   `notificationService.SendUnassignmentAsync(...)` (§E.7) — сервис сам проверит тумблер
   шаблона и отрендерит текст; никакого `SendEmail`-флага контроллер не передаёт.
3. Журнал: **новое** событие снятия — см. D.8.

Также **изменить** `AssignEmployeeAsync`: письмо назначения теперь строится не инлайном
(`BuildAssignmentDetailsText` + `emailSender.SendAssignmentAsync`), а через
`notificationService.SendAssignmentAsync(...)` (§E.7), сохранив условие `if (model.SendEmail)`.
Приватный `BuildAssignmentDetailsText` переезжает внутрь notification-сервиса (§E.7) как
HTML-builder деталей; из контроллера удаляется.

### D.7. Новые коды ошибок

Файл: `ATTours.Helper/Enums/GlobalErrorCode.cs` — **изменить**. В блок `#region EntityErrors`
добавить (следующие свободные значения после `OrderMustHaveAtLeastOneLine = 2028`):
```
[Description("Employee role is required to assign an employee.")]
EmployeeRoleRequired = 2029,
```

### D.8. Журнал заказа (OrderEvent) — снятие исполнителя

Назначение уже логируется (`OrderEventLog.LogEmployeeAssignedAsync`). Для снятия нужно новое
событие.

Файлы (по образцу существующего `LogEmployeeAssignedAsync`):
- `ATTours.Common/Enums/OrderEventType.cs` (или где определён тип события — **найти по
  `OrderEventLog`**) — **изменить**: добавить значение `EmployeeUnassigned`.
- `ATTours.Service/Services/Shared/OrderEventLog.cs` — **изменить**: добавить
  `LogEmployeeUnassignedAsync(orderId, actingUserId, employeeFullName, unassignedLineIds, bulk, ct)`
  по образцу `LogEmployeeAssignedAsync`. Сбой журнала не должен ронять операцию (существующий
  принцип — try/catch внутри, наружу не бросает).

Backend-developer: свериться с фактической сигнатурой `LogEmployeeAssignedAsync` и повторить
её форму для снятия. Если `EmployeeAssigned` — часть общего enum `OrderEventType`, добавить туда;
если события заданы иначе — по факту.

### D.9. Миграция для Задачи D

Отдельная миграция `AddEmployeeJobRole` (не смешивать с Задачей E — независимые фичи, чистая
история/откат):
- `User.DefaultJobRole` — `int NULL`.
- `OrderLine.EmployeeRole` — `int NULL`.

Data-миграция для существующих строк не нужна (оба поля nullable, «не задано» — валидное
состояние). Проект применяет миграции на старте API (см. память проекта) — ручных шагов нет.

---

## ЧАСТЬ E — Настройки уведомлений и WYSIWYG-шаблоны

### E.1. Инвентаризация: где сейчас отправляются письма заказов (проверено по коду)

Пройдено grep'ом по `Backend` (`emailSender.` / `IEmailSender` / `Send*Async`). Все методы
`IEmailSender` — плоский список; из них к **заказам** относятся только три; остальные — auth,
вне скоупа.

| action-key | Где триггерится (файл:строка) | Шлёт письмо сейчас? | Получатель | Метод IEmailSender |
| --- | --- | --- | --- | --- |
| `order.created` | `OrderController.CreateAsync` L58 | **Да** | Админ (`EmailSettings.AdminNotificationEmail`) | `SendNewOrderNotificationAsync` |
| `order.assign_employee` | `OrderController.AssignEmployeeAsync` L179 | **Да** (если `SendEmail`) | Исполнитель | `SendAssignmentAsync` (+ PDF) |
| `order.send_to_client` | `OrderController.SendToClientAsync` L200 | **Да** | Клиент | `SendOrderDocumentAsync` (+ PDF) |
| `order.unassign_employee` | **новый** (Задача D, §D.6) | Появляется сейчас | Снятый исполнитель | новый `SendUnassignmentAsync` |
| `order.status.*` (Approve/Reject/Reopen/Complete) | `OrderStatusService.SetStatusAsync` | **Нет** | — | — |

Факты, подтверждённые чтением кода:
- **`OrderStatusService` не отправляет никаких писем** — Approve/Reject/Reopen/Complete меняют
  только `Status`/`RejectReason`/`ApprovedAtUtc`. Значит их в настройки уведомлений **не
  включаем** (чек-лист: «если они шлют письма» — не шлют). Явно **вне скоупа**.
- «Отправить исполнителям» из админского меню — это **тот же** `AssignEmployee` c
  `SendEmail = true` (bulk, `LineId == null`), **отдельного эндпоинта/письма нет**. Отдельный
  action-key под него не заводим — он покрыт `order.assign_employee`.
- Все письма `AuthService` (verify email / password reset / email-change) — **вне скоупа**:
  это не письма заказов, ими админ не управляет, шаблоны для них не заводим.

**Управляемых action-key ровно четыре:** `order.created`, `order.assign_employee`,
`order.unassign_employee`, `order.send_to_client`.

Про `order.created`: это системное письмо админу (не действие админа), но оно строится инлайном
и относится к заказам — **включаем его в управляемые шаблоны** для единообразия (тумблер +
текст). В UI пометить, что выключать его не рекомендуется (админ перестанет узнавать о новых
бронях). Тумблер — да, но с предупреждением на фронте.

### E.2. Каталог ключей: enum `EmailActionKey`

Файл: `ATTours.Common/Enums/EmailActionKey.cs` — **создать**.
```
public enum EmailActionKey
{
    OrderCreated = 1,          // order.created — админу о новой брони
    OrderAssignEmployee = 2,   // order.assign_employee — исполнителю
    OrderUnassignEmployee = 3, // order.unassign_employee — снятому исполнителю
    OrderSendToClient = 4      // order.send_to_client — клиенту
}
```
Закрытый набор → enum, а не строковый ключ (в отличие от `SiteSetting`, где ключи открытые).
Хранится `int`, наружу уходит числом (фронт мапит на подписи раздела).

### E.3. Сущность `EmailTemplate` + хранение

Файл: `ATTours.Common/Entities/EmailTemplate.cs` — **создать**. Одна строка на `EmailActionKey`.
```
[EntityTypeConfiguration(typeof(EmailTemplateConfiguration))]
public class EmailTemplate : EntityBase
{
    public EmailActionKey ActionKey { get; set; }  // уникальный
    public bool IsEnabled { get; set; }
    public string Subject { get; set; }            // тема письма (может содержать плейсхолдеры)
    public string BodyHtml { get; set; }           // HTML тела, уже санитизированный (см. E.5)
}
```
Не `ITranslatableModel` (единственный язык — RU, см. E.9). Переводов нет.

Файл: `ATTours.Common/Infrastructure/EntityConfiguration/EmailTemplateConfiguration.cs` —
**создать**. По образцу `SiteSettingConfiguration`:
- `ToTable(nameof(EmailTemplate))`.
- `HasIndex(x => x.ActionKey).IsUnique()` — идентичность записи по ключу (upsert по нему).
- `Property(x => x.Subject).IsRequired().HasMaxLength(300)`.
- `Property(x => x.BodyHtml).IsRequired()` — без `HasMaxLength` → `nvarchar(max)` (HTML длинный).

Файл: `ATTours.DataLayer/ATToursContext.cs` — **изменить**: добавить
`public DbSet<EmailTemplate> EmailTemplates { get; set; }`.

### E.4. Плейсхолдеры

**Синтаксис:** `{{PascalCaseName}}` — двойные фигурные скобки, имя в PascalCase,
регистрозависимо. Пример: `{{OrderNumber}}`.

**Поведение при отсутствующем/устаревшем плейсхолдере** в сохранённом шаблоне: подставляется
**пустая строка** + пишется `logger.LogWarning` с ключом шаблона и именем неизвестного
плейсхолдера. Обоснование: оставить в клиентском письме литерал `{{Foo}}` — выглядит как баг;
пустая строка безопаснее; warning уведомляет, что шаблон устарел. (Литерал НЕ оставляем.)

**Значения подставляются как ТЕКСТ и HTML-кодируются** при рендере (защита от инъекции: имя
клиента/детали не должны прорастать разметкой). Исключение — составной блок `{{AssignmentDetails}}`,
который бэкенд сам строит как готовый безопасный HTML (см. E.7). Плейсхолдеры ставить только в
текстовые позиции; **не** внутрь `href`/атрибутов (санитайзер и HTML-кодирование это ломают —
для ссылок админ пишет реальный `href` руками; навигатор/pickup уходят в теле деталей и PDF).

**Каталог плейсхолдеров по ключу** (только реально выводимые в месте отправки):

| action-key | Плейсхолдеры |
| --- | --- |
| `OrderCreated` | `{{OrderNumber}}`, `{{TourTitle}}`, `{{TourDate}}`, `{{GuestCount}}`, `{{ClientName}}`, `{{ClientEmail}}` |
| `OrderAssignEmployee` | `{{OrderNumber}}`, `{{EmployeeName}}`, `{{EmployeeRole}}`, `{{AssignmentDetails}}` |
| `OrderUnassignEmployee` | `{{OrderNumber}}`, `{{EmployeeName}}`, `{{EmployeeRole}}` |
| `OrderSendToClient` | `{{OrderNumber}}`, `{{ClientName}}` |

Примечания:
- `{{EmployeeRole}}` → `EmployeeJobRole.ToRussianLabel()` (D.1).
- `{{TourDate}}` формат `dd.MM.yyyy` (как в текущем `BuildAssignmentDetailsText`).
- `{{AssignmentDetails}}` — HTML-блок «Тур/Дата/Гостей/Место встречи/Навигатор» по каждой
  назначенной строке (замена текущего plaintext `BuildAssignmentDetailsText`); строит бэкенд
  безопасно, не кодируется как текст.
- Каталог — **код-реестр** (статический словарь `EmailActionKey → string[]`), не хранится в БД.
  Отдаётся в GET (E.7), чтобы фронт показал доступные токены для вставки.

Файл: `ATTours.Common/Constants/EmailPlaceholders.cs` (или `ATTours.Helper`) — **создать**
статический реестр `IReadOnlyDictionary<EmailActionKey, string[]>` + имена-константы токенов.

### E.5. Санитизация HTML (защита от XSS)

Библиотека: **`HtmlSanitizer` (NuGet `Ganss.Xss`)** — де-факто стандарт для .NET, на базе
AngleSharp. Добавить `PackageReference` в `ATTours.Service` (в проекте сейчас нет sanitizer'а —
проверено по `.csproj`).

**Момент санитизации: на СОХРАНЕНИИ** (в БД лежит уже чистый HTML). При рендере повторно не
санитизируем (значения плейсхолдеров и так HTML-кодируются, E.4).

**Allow-list (объём «Word Light»: цвет, ссылки, размер, жирность):**
- Теги: `p, br, strong, b, em, i, u, s, span, a, ul, ol, li, h1, h2, h3, blockquote`.
- Атрибуты: `style` (свойства только `color`, `font-size`, `font-weight`, `text-decoration`,
  `text-align`), `a[href]`, `a[target]`, `a[rel]`.
- Схемы URL для `href`: только `http`, `https`, `mailto`. Всё остальное вырезать.
- Вырезать полностью: `script`, `style`, `iframe`, `object`, `embed`, любые `on*`-обработчики,
  `javascript:`-ссылки.

Конфигурацию allow-list задать один раз в сервисе валидации/сохранения (E.6), не размазывать.

### E.6. Сервисы хранения шаблонов (Info / Update / Validation)

По образцу связки `SiteSettingsInfo` / `SiteSettingsUpdateService` / `SiteSettingsValidationService`.

Файл: `ATTours.Service/Services/InfoServices/EmailTemplateInfo.cs` — **создать**.
- `Task<List<EmailTemplate>> GetAllAsync()` — все строки таблицы.
- `Task<EmailTemplate?> GetByKeyAsync(EmailActionKey key, ...)`.
- (Опционально) merge с каталогом ключей: если строки для ключа ещё нет — вернуть виртуальную
  запись с дефолтом `IsEnabled=true` и дефолтным шаблоном. Проще — гарантировать наличие всех 4
  строк сидом миграции (E.10), тогда merge не нужен. **Решение: сидим все 4 строки миграцией,
  merge не делаем.**

Файл: `ATTours.Service/Services/UpdateServices/EmailTemplateUpdateService.cs` — **создать**.
Upsert по `ActionKey` (образец `SiteSettingsUpdateService.UpsertAsync`, но идентичность — enum-ключ).
```
public class EmailTemplateUpdateService : RepositoryCoreBase<EmailTemplate, ATToursContextFactory>
{
    public Task<EmailTemplate> SaveAsync(EmailActionKey key, bool isEnabled, string subject, string bodyHtml);
}
```
Логика:
1. Валидация (см. `EmailTemplateValidationService`): `Subject` не пустой; `BodyHtml` не пустой;
   `key` в диапазоне enum.
2. **Санитизировать** `bodyHtml` через `HtmlSanitizer` (E.5) → сохраняем очищенный.
   (`Subject` — plaintext; вырезать теги целиком / HTML-энкодить, темы HTML не несут.)
3. Найти строку по `ActionKey`; нет — создать; проставить `IsEnabled/Subject/BodyHtml`; `SaveChanges`.

Файл: `ATTours.Service/Services/ValidationServices/EmailTemplateValidationService.cs` —
**создать** по образцу существующих Validation-сервисов. Правила выше; при нарушении —
`ErrorModelException(GlobalErrorCode.EmailTemplateInvalid, 400)` (новый код).

Новый код ошибки — `ATTours.Helper/Enums/GlobalErrorCode.cs`:
```
[Description("Email template is invalid (empty subject/body or unknown action key).")]
EmailTemplateInvalid = 2030,
```

### E.7. Рендер + отправка: `IOrderNotificationService`

Централизует три вещи (чтобы не размазывать по контроллеру и не утекала бизнес-логика):
проверку тумблера `IsEnabled`, рендер шаблона (подстановка плейсхолдеров, E.4), вызов
`IEmailSender`. **Это единственное место, где принимается решение "слать/не слать".**

Файл: `ATTours.Service/Notifications/IOrderNotificationService.cs` — **создать**.
```
public interface IOrderNotificationService
{
    Task SendOrderCreatedAsync(OrderInfoModel order, CancellationToken ct = default);
    Task SendAssignmentAsync(OrderInfoModel order, List<int> lineIds, string employeeEmail,
        string employeeName, EmployeeJobRole employeeRole, byte[] pdfDocument, CancellationToken ct = default);
    Task SendUnassignmentAsync(OrderInfoModel order, List<int> lineIds, string employeeEmail,
        string employeeName, EmployeeJobRole? employeeRole, CancellationToken ct = default);
    Task SendOrderDocumentAsync(OrderInfoModel order, byte[] pdfDocument, CancellationToken ct = default);
}
```
Файл: `ATTours.Service/Notifications/OrderNotificationService.cs` — **создать**. Реализация
каждого метода:
1. Загрузить `EmailTemplate` по нужному `EmailActionKey` (через `new EmailTemplateInfo(connectionString, ct)`
   — тот же паттерн `new XxxInfo(...)`, что и в контроллерах проекта).
2. Если `template is null || !template.IsEnabled` → **return** (тихо не шлём).
3. Собрать словарь плейсхолдеров под этот action-key из переданных данных (`{{OrderNumber}}` из
   `order.Number` и т.д.). `{{AssignmentDetails}}` — построить HTML-блок (перенос
   `BuildAssignmentDetailsText` из `OrderController`, но в HTML: `<br>` вместо `\n`,
   HTML-энкод значений строк).
4. Отрендерить `Subject` и `BodyHtml`: заменить `{{Token}}` на HTML-кодированные значения
   (кроме `AssignmentDetails`); неизвестный токен → "" + `LogWarning` (E.4).
5. Вызвать `IEmailSender.SendTransactionalAsync(toEmail, toName, renderedSubject, renderedHtml,
   attachment?, ct)` — новый унифицированный метод (E.8). Вложение (PDF) прокидывается для
   assign/send_to_client.

**DI:** `IOrderNotificationService` регистрируется в
`ATTours.ClientAPI/DependencyInjection/DependencyInjectionConfiguration.cs` (`AddServices`) как
`Scoped`, потому что ему нужен внедрённый singleton `IEmailSender` (его нельзя `new`-нуть в
контроллере — ровно то же обоснование, что для самого `IEmailSender`, ADR 005). Строку
подключения к БД для `EmailTemplateInfo` берёт из `CommonSettings.Instance.ATToursConnectionString`
(как остальные сервисы). Это осознанное второе (после auth) DI-исключение — не `new Service()`.

**`OrderController`** — **изменить** конструктор:
`OrderController(IMapper mapper, IOrderNotificationService notificationService)`. Прямой
`IEmailSender` из контроллера убирается (все письма заказов идут через notification-сервис):
- `CreateAsync`: `emailSender.SendNewOrderNotificationAsync(...)` → `notificationService.SendOrderCreatedAsync(result, ct)`.
- `AssignEmployeeAsync`: инлайновую сборку письма заменить на
  `if (model.SendEmail) await notificationService.SendAssignmentAsync(orderDto, assignment.AssignedLineIds, assignment.EmployeeEmail, assignment.EmployeeFullName, assignment.EmployeeRole, pdfDocument, ct);`
  PDF по-прежнему генерит `OrderPdfService.GenerateAssignmentDocument`. `BuildAssignmentDetailsText`
  из контроллера **удалить** (переехал в notification-сервис как HTML-builder).
- `SendToClientAsync`: `emailSender.SendOrderDocumentAsync(...)` →
  `notificationService.SendOrderDocumentAsync(orderDto, pdfDocument, ct)`.
- `UnassignEmployeeAsync` (новый, D.6): по каждому снятому — `notificationService.SendUnassignmentAsync(...)`.

Сбой провайдера/письма по-прежнему не должен ронять операцию — этот принцип остаётся внутри
`IEmailSender` (провайдер не бросает наружу).

### E.8. Согласование `SendEmail` (per-call) и `IsEnabled` (persistent) — важно

Оба флага сохраняются и работают вместе. Итоговое правило:

> **Письмо назначения уходит ⟺ `model.SendEmail` (намерение вызова) И `template.IsEnabled`
> (глобальный тумблер).**

- `SendEmail` = намерение конкретного клика (попап «Назначить» = `false`, «Назначить и
  отправить письмо» = `true`) — **остаётся**, это UX-развилка двух кнопок.
- `IsEnabled` = глобальный админский рубильник в разделе «Настройки уведомлений» — **новое**.
  Приоритетнее: выключен → не шлём даже при `SendEmail = true`.
- Реализация: контроллер по-прежнему делает `if (model.SendEmail)`, а сам notification-сервис
  внутри проверяет `IsEnabled` и молча не шлёт, если выключено. Так проверка `IsEnabled` не
  дублируется по вызовам.
- Для остальных действий персонального `SendEmail` нет — решает только `IsEnabled`:
  - `order.created` — шлём ⟺ `IsEnabled`.
  - `order.unassign_employee` — шлём ⟺ `IsEnabled` (D.6, отдельного «тихого снятия» в UX нет).
  - `order.send_to_client` — действие «Отправить клиенту» само по себе есть запрос на отправку;
    если тумблер выключен — письмо не уйдёт. **Решение по UX:** кнопка остаётся видимой,
    отправка тихо не происходит при выключенном тумблере (симметрично прочим); фронт может
    подсветить, что канал выключен, но это не обязательное требование бэкенда.

### E.9. `IEmailSender` — переход на HTML для писем заказов

Сейчас все реализации шлют `textContent` (plaintext). Шаблоны — HTML, значит для писем заказов
нужен `htmlContent`.

Файл: `ATTours.Service/Email/IEmailSender.cs` — **изменить**. Добавить единый метод:
```
Task SendTransactionalAsync(string toEmail, string toName, string subject, string bodyHtml,
    EmailAttachment? attachment = null, CancellationToken ct = default);
```
`EmailAttachment` — новый маленький тип (`ATTours.Service/Email/EmailAttachment.cs`,
`{ string FileName; byte[] Content; }`) вместо отдельного `byte[]`-параметра.

Старые **order-специфичные** методы `SendNewOrderNotificationAsync`, `SendOrderDocumentAsync`,
`SendAssignmentAsync` — **удалить** из интерфейса и всех реализаций (их вызовы уходят в
notification-сервис через `SendTransactionalAsync`). **Auth-методы** (`SendEmailVerificationAsync`,
`SendPasswordResetAsync`, `SendEmailChange*`) и `ExposesTokenToCaller` — **не трогать**.

Файлы реализаций — **изменить**:
- `ATTours.Service/Email/BrevoEmailSender.cs`, `SendGridEmailSender.cs`, `DevEmailSender.cs`:
  реализовать `SendTransactionalAsync` — payload с `htmlContent` (Brevo) / html body (SendGrid) /
  лог HTML (Dev). Вложение прокидывать как раньше (Brevo: массив `attachment`;
  SendGrid — по его схеме). Удалить три order-метода.
- `ATTours.Service/Email/EmailMessageFactory.cs` — **изменить**: удалить order-билдеры
  (`NewOrderNotification*`, `OrderDocument*`, `Assignment*`) — их роль теперь у шаблонов в БД.
  Auth-билдеры (`Verify/Reset/EmailChange*`) оставить.

Дефолтные тексты писем заказов, которые сейчас в `EmailMessageFactory`, переносятся не в код, а
в **сид шаблонов** (E.10) — уже в виде HTML.

### E.10. Дефолтный сид шаблонов (в миграции Задачи E)

Миграция `AddEmailTemplates` (см. E.11) сидит 4 строки `EmailTemplate` (`IsEnabled = true`) с
дефолтными Subject/BodyHtml — HTML-версии текущих plaintext-писем из `EmailMessageFactory`.
Соответствие «старый текст → новый шаблон»:
- `OrderCreated` ← `NewOrderNotificationSubject` / `BuildNewOrderNotificationBody`, плейсхолдеры
  `{{TourTitle}} {{TourDate}} {{GuestCount}} {{ClientName}} {{ClientEmail}}`.
- `OrderAssignEmployee` ← `AssignmentSubject` / `BuildAssignmentBody`, с `{{OrderNumber}}
  {{EmployeeName}} {{EmployeeRole}} {{AssignmentDetails}}`. (`{{EmployeeRole}}` — новая строчка
  в теле, т.к. Задача D требует роль в письме.)
- `OrderUnassignEmployee` ← **новый** дефолт (аналогичного письма раньше не было): короткое
  «С вас снято назначение по заказу № {{OrderNumber}}» + `{{EmployeeName}} {{EmployeeRole}}`.
- `OrderSendToClient` ← `OrderDocumentSubject` / `BuildOrderDocumentBody`, `{{OrderNumber}}
  {{ClientName}}`.

HTML держать простым (абзацы `<p>`, `<br>`) — он и так пройдёт allow-list (E.5).

### E.11. Эндпоинты раздела «Настройки уведомлений»

Новый контроллер. Файл: `ATTours.ClientAPI/Controllers/EmailTemplateController.cs` — **создать**,
весь `[Authorize(Roles = ApiRoles.Admin)]`, конструктор `(IMapper mapper)` (сервисы через
`new`, как в `UsersController`).

| Метод | Маршрут | Тело/параметры | Возврат | Назначение |
| --- | --- | --- | --- | --- |
| GET | `api/EmailTemplate` | — | `List<EmailTemplateInfoModel>` | все шаблоны + тумблеры + каталог плейсхолдеров |
| GET | `api/EmailTemplate/{actionKey:int}` | `actionKey` | `EmailTemplateInfoModel` | один шаблон |
| PUT | `api/EmailTemplate` | `EmailTemplateUpdateModel` | `EmailTemplateInfoModel` | upsert (тумблер + subject + bodyHtml) |

DTO:
- `ATTours.Common/DTO/Info/EmailTemplateInfoModel.cs` — **создать**:
  ```
  public class EmailTemplateInfoModel
  {
      public EmailActionKey ActionKey { get; set; }
      public bool IsEnabled { get; set; }
      public string Subject { get; set; }
      public string BodyHtml { get; set; }
      public List<string> AvailablePlaceholders { get; set; } = []; // из код-реестра E.4
      public string DisplayName { get; set; }        // человекочитаемое имя действия (RU)
      public string RecipientDescription { get; set; } // «Исполнителю» / «Клиенту» / «Админу»
  }
  ```
  `DisplayName`/`RecipientDescription`/`AvailablePlaceholders` — из код-реестра (не из БД),
  проставляются при маппинге/в Info-сервисе.
- `ATTours.Common/DTO/Request/EmailTemplateUpdateModel.cs` — **создать**:
  ```
  public class EmailTemplateUpdateModel
  {
      public EmailActionKey ActionKey { get; set; }
      public bool IsEnabled { get; set; }
      public string Subject { get; set; }
      public string BodyHtml { get; set; }
  }
  ```

AutoMapper (`MappingProfile`): `EmailTemplate → EmailTemplateInfoModel`; поля-каталога
(`AvailablePlaceholders/DisplayName/RecipientDescription`) — `AfterMap` из код-реестра по `ActionKey`.

Контроллер:
- GET all: `new EmailTemplateInfo(...).GetAllAsync()` → `mapper.Map<List<...>>`.
- GET one: `GetByKeyAsync` → 404 при отсутствии (после сида все 4 есть; страховка на всякий).
- PUT: `new EmailTemplateUpdateService(ct).SaveAsync(model.ActionKey, model.IsEnabled,
  model.Subject, model.BodyHtml)` → `mapper.Map<EmailTemplateInfoModel>`.

### E.12. Миграция для Задачи E

Отдельная миграция `AddEmailTemplates`:
- Таблица `EmailTemplate` (`Id, ActionKey int unique, IsEnabled bit, Subject nvarchar(300),
  BodyHtml nvarchar(max)` + поля `EntityBase`).
- Data-сид 4 строк (E.10).

### E.13. WYSIWYG на фронте — вне бэкенд-скоупа (передать `architect`)

Выбор WYSIWYG-библиотеки и структура фронтенд-фичи `features/admin/notifications` — зона
фронтенд-`architect` (чек-лист E.3), не бэкенда. Бэкенд-контракт для неё: GET/PUT из E.11,
формат `bodyHtml`, синтаксис плейсхолдеров `{{...}}` (E.4), allow-list тегов (E.5) — редактор
должен генерить HTML в пределах этого allow-list (иначе санитайзер срежет на сохранении).

**Решено 2026-08-22 (обновление):** первая реализация (`contentEditable` + `document.execCommand`)
оказалась нечинибельной по выделению и переехала на Tiptap; редактор стал общим примитивом
админки `features/admin/ui/RichTextEditor/`. Почему — [ADR 023](adr/023-rich-text-editor-on-tiptap.md),
что делать — [спека 011](specs/011-rich-text-editor.md). Бэкенд-контракт (E.4/E.5/E.11) при этом
не менялся: `bodyHtml` по-прежнему укладывается в allow-list E.5, плейсхолдеры по-прежнему
хранятся обычным текстом `{{Token}}`.

**Дополнение 2026-08-22:** Давид попросил картинки в теле письма и свободный выбор цвета —
это первое изменение allow-list E.5 с момента его введения. Точное ТЗ на бэкенд (тег `img` +
атрибуты `src/alt/width`, валидация `src`, абсолютизация `/uploads/...` при ОТПРАВКЕ письма,
валидация значений CSS-свойств, а не только их имён) — [спека 012](specs/012-rich-text-editor-backend-requirements.md).
Заголовки `h1–h3` и `text-align`, которые тоже добавляются в редактор, allow-list разрешал
изначально — по ним бэкенду делать нечего.

Архитектурное решение по бэкенду (профили санитайзера, механизм `PostProcessDom`,
абсолютизация на отправке, лимит длины `bodyHtml`) — [ADR 026](adr/026-html-sanitization-profiles-and-send-time-absolutization.md),
ТЗ для `backend-developer` — [спека 013](specs/013-rich-text-sanitizer-backend.md).

**Реализовано и проверено 2026-08-22.** Фронт: `features/admin/ui/RichTextEditor/` собран на
Tiptap v3, `EmailTemplateCard` мигрирован, старый `execCommand`-редактор удалён. `tsc`/`vite build`
чисты, Tiptap подтверждён только в admin-чанках (grep по `ProseMirror` в билде — 0 хитов в
публичных чанках). Живая проверка в браузере (dev-логин, `/admin/notifications`): выделение +
жирность применяется к выделению (баг 2 закрыт), размер+цвет применяются последовательно без
сброса друг друга (баг 1 закрыт), меню «Вставить поле» вставляет плейсхолдер человеко-читаемым
пунктом в позицию курсора (баг 3 закрыт), 375px — без горизонтального переполнения. Бэкенд:
`ATTours.Service/Html/` (`RichHtmlSanitizer`+`HtmlContentPolicy`+`MediaUrlAbsolutizer`) собран,
все пары «вход→ожидаемое в БД» из спеки 013 §Д прошли curl-проверкой, идемпотентность цвета
(`PUT`→`GET`→`PUT` побайтово одинаково) подтверждена. Единственное известное ограничение:
`style="text-decoration:..."` не доживает до БД (AngleSharp режет shorthand раньше нашего
прохода) — подчёркивание работает только через тег `<u>`, чем Tiptap и пользуется. Фаза 2
(описания туров/дней) не начата — компонент готов принять `toolset` под неё, но нигде не
подключён.

---

## Сводка «что создать / что изменить»

### ATTours.Common
- **создать** `Enums/EmployeeJobRole.cs`, `Enums/EmailActionKey.cs`
- **создать** `Extensions/EmployeeJobRoleExtensions.cs`
- **создать** `Constants/EmailPlaceholders.cs` (реестр плейсхолдеров/каталог)
- **создать** `Entities/EmailTemplate.cs`
- **создать** `Infrastructure/EntityConfiguration/EmailTemplateConfiguration.cs`
- **создать** DTO: `DTO/Request/OrderUnassignEmployeeModel.cs`, `DTO/Request/SetUserJobRoleModel.cs`,
  `DTO/Request/EmailTemplateUpdateModel.cs`, `DTO/Info/EmailTemplateInfoModel.cs`
- **изменить** `Entities/User.cs` (+`DefaultJobRole`), `Entities/OrderLine.cs` (+`EmployeeRole`)
- **изменить** `DTO/Request/OrderAssignEmployeeModel.cs` (+`EmployeeRole`)
- **изменить** `DTO/Info/OrderLineInfoModel.cs` (+`EmployeeRole`)
- **изменить** `DTO/Auth/UserInfoModel.cs`, `DTO/Auth/UserDetailInfoModel.cs` (+`DefaultJobRole`)

### ATTours.Helper
- **изменить** `Enums/GlobalErrorCode.cs` (+`EmployeeRoleRequired = 2029`, `EmailTemplateInvalid = 2030`)

### ATTours.DataLayer
- **изменить** `ATToursContext.cs` (+`DbSet<EmailTemplate>`)
- **создать** миграции `AddEmployeeJobRole`, `AddEmailTemplates` (сид 4 шаблонов)

### ATTours.Service (ATTours.BusinessServices)
- **создать** `Services/UpdateServices/UserJobRoleUpdateService.cs`
- **создать** `Services/UpdateServices/OrderUnassignEmployeeService.cs`
- **создать** `Services/UpdateServices/EmailTemplateUpdateService.cs`
- **создать** `Services/InfoServices/EmailTemplateInfo.cs`
- **создать** `Services/ValidationServices/EmailTemplateValidationService.cs`
- **создать** `Notifications/IOrderNotificationService.cs`, `Notifications/OrderNotificationService.cs`
- **создать** `Email/EmailAttachment.cs`
- **изменить** `Services/UpdateServices/OrderAssignEmployeeService.cs` (роль в снапшот + результат)
- **изменить** `Services/Shared/OrderEventLog.cs` (+`LogEmployeeUnassignedAsync`) и enum типа события
- **изменить** `Email/IEmailSender.cs` (+`SendTransactionalAsync`, −3 order-метода)
- **изменить** `Email/BrevoEmailSender.cs`, `Email/SendGridEmailSender.cs`, `Email/DevEmailSender.cs`
  (HTML + `SendTransactionalAsync`, −order-методы)
- **изменить** `Email/EmailMessageFactory.cs` (−order-билдеры)
- **PackageReference** `Ganss.Xss` (HtmlSanitizer) в `ATTours.Service.csproj`

### ATTours.ClientAPI
- **создать** `Controllers/EmailTemplateController.cs`
- **изменить** `Controllers/OrderController.cs` (конструктор → `IOrderNotificationService`;
  `UnassignEmployee`; рефактор Create/Assign/SendToClient на notification-сервис; удалить
  `BuildAssignmentDetailsText`)
- **изменить** `Controllers/UsersController.cs` (+`SetJobRole`)
- **изменить** `DependencyInjection/DependencyInjectionConfiguration.cs`
  (+`AddScoped<IOrderNotificationService, OrderNotificationService>()`)
- **изменить** `Mapper/MappingProfile.cs` (маппинг `EmailTemplate → EmailTemplateInfoModel`;
  проверить, что `EmployeeRole`/`DefaultJobRole` не `Ignore()`-ятся)

### Явно вне скоупа
- Approve/Reject/Reopen/Complete-письма (их нет — `OrderStatusService` не шлёт почту).
- Auth-письма (verify/reset/email-change) — не управляются шаблонами.
- Мультиязычные шаблоны писем (только RU).
- Плейсхолдеры внутри `href`/атрибутов.
- Выбор WYSIWYG-библиотеки и фронтенд-фича `features/admin/notifications` (зона `architect`).
- Весь фронтенд Задач D/E (пункты D.3–D.7, E.3–E.6 чек-листа).
