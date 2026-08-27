# Архитектура: мульти-исполнители на строке заказа + настраиваемые получатели уведомлений + билингвальные письма

Проектный документ для `backend-developer`. Источник требований —
`checklist-notification-recipients-redesign.txt` (решения Давида, 2026-08-23), раздел
«ПОРЯДОК РАБОТЫ → Фаза 1». Документ-преемник
[architecture-role-notifications.md](architecture-role-notifications.md) в части Задач D и E:
всё, что там описано, остаётся в силе, кроме явно переопределённого здесь (см. §0.1).

Реализовывать строго по этому документу. Дополнительных архитектурных решений принимать
не нужно — всё, что было «на усмотрение», решено здесь. Образцы для стиля реализации —
существующие вертикальные срезы `Order`/`OrderLine`/`OrderAssignEmployeeService`/
`OrderController` и `EmailTemplate`/`EmailTemplateInfo`/`EmailTemplateUpdateService`/
`EmailTemplateController`.

Фронтенд (грид «Событие» → вкладки «Платформы»/«Email Settings»/«Telegram Settings»,
попап мультиназначения, `OrderFulfillmentTab` по исполнителям) — **вне скоупа этого
документа**, это Фаза 3 чек-листа.

---

## §0. Что меняется концептуально

### 0.1. Переопределения предыдущего документа

| Было (architecture-role-notifications.md) | Стало (этот документ) | § |
| --- | --- | --- |
| Один исполнитель на `OrderLine` (`OrderLine.EmployeeId/EmployeeRole`) | N исполнителей на строке через join-сущность `OrderLineEmployee`, у каждого своя роль | §A |
| `PickupDetails`/`NavigatorLink` на `OrderLine` | На `OrderLineEmployee` (у каждого исполнителя своя карточка деталей) + новое поле `Comment`/`CommentEn` | §A.1 |
| Письма только RU (§E.9 «мультиязычные шаблоны вне скоупа») | Все 4 письма билингвальны: `Subject/SubjectEn`, `BodyHtml/BodyHtmlEn`, язык выбирается по получателю | §B |
| Получатели зашиты в код (`OrderNotificationService`: админский ящик / исполнитель / клиент) | Получатели — строки в БД (`NotificationRecipient`), настраиваются админом; хардкод удаляется | §C |
| `EmailTemplate.IsEnabled` — рубильник события | `NotificationChannel.IsEnabled` — рубильник пары (событие × платформа); `EmailTemplate.IsEnabled` удаляется | §C.2 |
| `EmailTemplateController` (`api/EmailTemplate`) | `NotificationSettingsController` (`api/NotificationSettings`); старый контроллер и его DTO удаляются | §E.4 |
| PDF генерит контроллер и передаёт в notification-сервис | PDF генерит сам notification-сервис (у каждого исполнителя своё вложение) | §D.5 |

### 0.2. Что НЕ меняется

- Набор из 4 событий (`EmailActionKey`) закрыт: create/delete событий нет.
- Набор order-linked ролей закрыт: `Client`, `Employee`. «Админ» order-linked ролью **не**
  становится — админ выбирается обычной строкой-получателем (§C.3).
- Синтаксис плейсхолдеров `{{PascalCase}}`, HTML-кодирование значений, allow-list санитайзера,
  абсолютизация media-URL на отправке — всё как в
  [ADR 026](adr/026-html-sanitization-profiles-and-send-time-absolutization.md) и §E.4/E.5
  предыдущего документа.
- `OrderAssignEmployeeModel.SendEmail` остаётся (два действия попапа: «Назначить» /
  «Назначить и отправить»). Правило §E.8 сохраняется: письмо уходит ⟺ намерение вызова
  И включённый канал.
- Auth-письма (verify/reset/email-change) шаблонами и получателями не управляются.

### 0.3. Telegram

В этой задаче Telegram — **только модель и настройки**: значение `NotificationPlatform.Telegram`,
строка в `NotificationChannel`, строки-получатели с `Platform = Telegram`, отдача/приём их в
GET/PUT. **Реальной отправки нет**: `OrderNotificationService` обрабатывает только
`Platform.Email` и для Telegram молча ничего не делает. Никаких `ITelegramSender`,
`BotToken`, `ChatId` в этой задаче не заводить.

---

## ЧАСТЬ A — Мульти-исполнители на строке заказа

### A.1. Сущность `OrderLineEmployee`

Файл: `ATTours.Common/Entities/OrderLineEmployee.cs` — **создать**.

```csharp
// Назначение конкретного сотрудника на конкретную строку заказа (редизайн 2026-08-23).
// Заменяет плоские OrderLine.EmployeeId/EmployeeRole/PickupDetails/NavigatorLink: на одной
// строке может работать несколько человек одновременно (водитель + гид — валидный случай),
// и у каждого своя роль и свои "детали для выполнения".
[EntityTypeConfiguration(typeof(OrderLineEmployeeConfiguration))]
public class OrderLineEmployee : EntityBase
{
    public int OrderLineId { get; set; }
    public OrderLine OrderLine { get; set; }

    public int EmployeeId { get; set; }
    public User Employee { get; set; }

    // Non-nullable: назначения без роли не существует (инвариант Задачи D сохраняется,
    // гейт стоит в OrderAssignEmployeeService). Это снапшот на момент назначения, а не
    // FK на User.DefaultJobRole — роль в попапе переопределяется.
    public EmployeeJobRole EmployeeRole { get; set; }

    // "Детали для выполнения" — теперь per-исполнитель, а не per-строка: водитель и гид
    // на одной брони встречают клиента по-разному.
    public string PickupDetails { get; set; }
    public string NavigatorLink { get; set; }

    // Свободный комментарий исполнителю. Две языковые версии — в письмо уходит та, что
    // соответствует PreferredLanguage получателя (§B.3). Обе nullable: незаполненное поле
    // не появляется ни в письме, ни в PDF (§D.6).
    public string Comment { get; set; }
    public string CommentEn { get; set; }
}
```

**Решено: отдельная таблица с двумя FK, а не JSON-колонка / не список ролей на строке.**
Обоснование: у связки есть собственные атрибуты (роль + 4 текстовых поля), по ней фильтруют
(`GetAssignedToMe`, §A.5) и её правят точечно (карточка деталей исполнителя, §E.2) — это
полноценная сущность, а не значение. Прямой аналог в кодовой базе — `TourTag`/`TourRegion`.

**Решено: уникальность — `(OrderLineId, EmployeeId)`, один сотрудник не может быть добавлен
на одну строку дважды.** Обоснование: два назначения одного человека на одну строку
различались бы только ролью, а для случая «и водитель, и гид» уже есть
`EmployeeJobRole.DriverGuide` — заводить дубль ради этого значит держать две карточки
деталей одному человеку на одной броне. Повторное назначение того же человека — это
изменение его роли/деталей (upsert, §A.4), а не вторая строка.

### A.2. Конфигурация EF

Файл: `ATTours.Common/Infrastructure/EntityConfiguration/OrderLineEmployeeConfiguration.cs` —
**создать**. Образец — `TourTagConfiguration` (join-сущность с двумя родителями,
оба FK конфигурируются здесь).

```csharp
builder.ToTable(nameof(OrderLineEmployee));

// Cascade: строку заказа удаляют вместе с назначениями — назначение без строки бессмысленно
// (та же семантика, что у OrderLine -> Order).
builder.HasOne(x => x.OrderLine)
    .WithMany(x => x.Employees)
    .HasForeignKey(x => x.OrderLineId)
    .OnDelete(DeleteBehavior.Cascade);

// Restrict — как было у OrderLine.Employee: сотрудник это обычный User (soft-delete),
// заказ не должен молча остаться без ссылки на исполнителя.
builder.HasOne(x => x.Employee)
    .WithMany()
    .HasForeignKey(x => x.EmployeeId)
    .OnDelete(DeleteBehavior.Restrict);

builder.HasIndex(x => new { x.OrderLineId, x.EmployeeId }).IsUnique();

// Кабинет сотрудника (GetAssignedToMe) фильтрует по исполнителю — индекс переезжает
// сюда с OrderLine.EmployeeId.
builder.HasIndex(x => x.EmployeeId);

builder.Property(x => x.NavigatorLink).HasMaxLength(1000);
// PickupDetails/Comment/CommentEn — без HasMaxLength (nvarchar(max)): свободный текст
// без осмысленного потолка, как BodyHtml у EmailTemplate.
```

Обратной навигации `User.LineAssignments` **не заводить** — её никто не читает (тот же
принцип, что у `Order.User` и `OrderEvent`).

### A.3. Изменения `OrderLine`

Файл: `ATTours.Common/Entities/OrderLine.cs` — **изменить**.

- **Удалить**: `EmployeeId`, `Employee`, `EmployeeRole`, `PickupDetails`, `NavigatorLink`.
- **Добавить**:
  ```csharp
  // Исполнители строки (0..N). Пустая коллекция — строка не назначена.
  public HashSet<OrderLineEmployee> Employees { get; set; } = [];
  ```

Файл: `ATTours.Common/Infrastructure/EntityConfiguration/OrderLineConfiguration.cs` —
**изменить**: удалить блок `HasOne(x => x.Employee)...` и `HasIndex(x => x.EmployeeId)`
(оба переехали в `OrderLineEmployeeConfiguration`). Остальное не трогать.

Файл: `ATTours.DataLayer/ATToursContext.cs` — **изменить**: добавить
`public DbSet<OrderLineEmployee> OrderLineEmployees { get; set; }`.

### A.4. Контракт назначения — мультивыбор

Файл: `ATTours.Common/DTO/Request/OrderAssignEmployeeModel.cs` — **изменить**.

```csharp
public class OrderAssignEmployeeModel
{
    public int OrderId { get; set; }

    // null = на все строки заказа (bulk-семантика сохраняется без изменений).
    public int? LineId { get; set; }

    // Мультивыбор попапа: список людей, у каждого своя роль. Пустой список — 400.
    public List<OrderAssignEmployeeItem> Employees { get; set; } = [];

    public bool SendEmail { get; set; } = true;
}

public class OrderAssignEmployeeItem
{
    public int EmployeeId { get; set; }
    public EmployeeJobRole EmployeeRole { get; set; }   // обязательна, non-nullable
}
```

**Решено: семантика Assign — аддитивный upsert, а не «заменить набор исполнителей».**
Для каждой целевой строки и каждого элемента `Employees`:
- строки `(line, employee)` нет → создать `OrderLineEmployee` (`PickupDetails`/`NavigatorLink`/
  `Comment`/`CommentEn` = null);
- строка есть → обновить только `EmployeeRole`, детали **не затирать** (их правят отдельным
  эндпоинтом §E.2, и переназначение роли не должно стирать уже введённый pickup).

Исполнители, не перечисленные в запросе, **не снимаются** — для снятия есть `Unassign`.
Обоснование: bulk-режим (`LineId == null`) с replace-семантикой одним неосторожным
сохранением стёр бы разных исполнителей по всем строкам заказа, и откатить это нечем.
Фронт снимает «расчекнутых» отдельным вызовом `UnassignEmployee` с конкретным `EmployeeId`.

Файл: `ATTours.Service/Services/UpdateServices/OrderAssignEmployeeService.cs` — **изменить**
(фактически переписать). Контракт:

```csharp
public class OrderAssignEmployeeService : RepositoryCoreBase<Order, ATToursContextFactory>
{
    public Task<OrderAssignEmployeeResult> AssignAsync(OrderAssignEmployeeModel model);
}

public class OrderAssignEmployeeResult
{
    // Все затронутые строки — для журнала.
    public List<int> AffectedLineIds { get; set; } = [];

    // По одному элементу на сотрудника: письмо назначения персональное (§D.4).
    public List<OrderEmployeeRecipient> Assigned { get; set; } = [];
}
```

Логика:
1. `model.Employees` пуст → `ErrorModelException(GlobalErrorCode.EmployeeRoleRequired, 400)`.
2. Для каждого элемента: `!Enum.IsDefined(item.EmployeeRole)` → `EmployeeRoleRequired` (гейт
   Задачи D сохраняется — 0 не входит в enum).
3. Дубликаты `EmployeeId` внутри `model.Employees` → `ErrorModelException(
   GlobalErrorCode.EmployeeRoleRequired, 400)` (тот же смысл: неоднозначная роль).
4. Одним запросом загрузить всех сотрудников из `model.Employees` с `Include(x => x.Role)`
   и `Role.Type == RoleType.Employee`; кого-то не нашли → `UserIsNotEmployee` (400). Выбирать
   `Email, FirstName, LastName, PreferredLanguage` (язык нужен письму, §B.2).
5. Загрузить заказ: `Include(Lines).ThenInclude(line => line.Employees)`. Нет — `OrderNotFound`.
6. `targets` — все строки или одна по `LineId`; `LineId` задан, а строки нет —
   `OrderLineNotFound`.
7. Upsert по правилу выше, `SaveChangesAsync`.
8. Собрать `Assigned`: по одному `OrderEmployeeRecipient` на сотрудника, `LineIds` — строки,
   на которые он назначен **этим вызовом**.

### A.5. Снятие исполнителя — по конкретному человеку

Файл: `ATTours.Common/DTO/Request/OrderUnassignEmployeeModel.cs` — **изменить**.

```csharp
public class OrderUnassignEmployeeModel
{
    public int OrderId { get; set; }

    // null = все строки заказа (bulk-семантика сохраняется).
    public int? LineId { get; set; }

    // null = снять ВСЕХ исполнителей с целевых строк (текущее поведение кнопки
    // "снять исполнителя" со строки целиком); задан = снять только этого человека.
    public int? EmployeeId { get; set; }
}
```

**Решено: `EmployeeId` nullable, а не обязательный.** Чек-лист требует уметь снимать
конкретного человека — это и делает заданный `EmployeeId`. Но существующее действие «снять
исполнителя со строки» (когда на строке один человек) и bulk «снять со всех строк» терять
нельзя, а заставлять фронт слать N вызовов по числу исполнителей — лишний трафик и
неатомарность. Один параметр покрывает оба случая.

Файл: `ATTours.Service/Services/UpdateServices/OrderUnassignEmployeeService.cs` — **изменить**.

```csharp
public class OrderUnassignEmployeeService : RepositoryCoreBase<Order, ATToursContextFactory>
{
    public Task<OrderUnassignEmployeeResult> UnassignAsync(OrderUnassignEmployeeModel model);
}

public class OrderUnassignEmployeeResult
{
    public List<int> UnassignedLineIds { get; set; } = [];

    // Пустой список — снимать было нечего (идемпотентный повтор), это не ошибка.
    public List<OrderEmployeeRecipient> Unassigned { get; set; } = [];
}
```

Логика: загрузить заказ с `Include(Lines).ThenInclude(l => l.Employees).ThenInclude(e => e.Employee)`;
`targets` по `LineId`; отобрать `OrderLineEmployee` целевых строк, отфильтровав по
`model.EmployeeId`, если он задан; **захватить данные снятых до удаления** (иначе письмо
слать некому); `Context.Set<OrderLineEmployee>().RemoveRange(...)`; `SaveChangesAsync`.
Класс `UnassignedEmployee` **удалить** — его заменяет общий `OrderEmployeeRecipient`.

### A.6. Общий тип получателя-исполнителя

Файл: `ATTours.Service/Notifications/OrderEmployeeRecipient.cs` — **создать**.

```csharp
// Исполнитель как адресат письма заказа: результат Assign/Unassign и то, во что резолвится
// order-linked получатель "Исполнитель заказа" (§D.3). Один экземпляр = одно персональное
// письмо (у каждого свой язык, свои детали и своё PDF-вложение).
public class OrderEmployeeRecipient
{
    public int EmployeeId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public EmployeeJobRole EmployeeRole { get; set; }
    public LanguageCode PreferredLanguage { get; set; } = LanguageCode.Russian;

    // Строки заказа, к которым относится ЭТО письмо.
    public List<int> LineIds { get; set; } = [];
}
```

### A.7. DTO строки заказа

Файл: `ATTours.Common/DTO/Info/OrderLineEmployeeInfoModel.cs` — **создать**.

```csharp
public class OrderLineEmployeeInfoModel
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeFullName { get; set; }   // денормализация, AfterMap
    public EmployeeJobRole EmployeeRole { get; set; }
    public string PickupDetails { get; set; }
    public string NavigatorLink { get; set; }
    public string Comment { get; set; }
    public string CommentEn { get; set; }
}
```

Файл: `ATTours.Common/DTO/Info/OrderLineInfoModel.cs` — **изменить**:
- **удалить** `EmployeeId`, `EmployeeFullName`, `EmployeeRole`, `PickupDetails`, `NavigatorLink`;
- **добавить** `public List<OrderLineEmployeeInfoModel> Employees { get; set; } = [];`.

Файл: `ATTours.Common/DTO/Info/OrderInfoModel.cs` — **изменить**: добавить
```csharp
// Язык клиента — нужен резолверу получателя "Клиент заказа" (§D.3), чтобы выбрать
// языковую версию письма без второго похода в БД.
public LanguageCode UserPreferredLanguage { get; set; }
```

Файл: `ATTours.ClientAPI/Mapper/MappingProfile.cs` — **изменить**:
- `CreateMap<OrderLineEmployee, OrderLineEmployeeInfoModel>()` с `Ignore()` на
  `EmployeeFullName` + `AfterMap`, собирающим ФИО из `source.Employee` (по образцу
  `ApplyOrderLineDenormalizedFields`).
- `ApplyOrderLineDenormalizedFields`: убрать ветку `source.Employee` (её больше нет);
  `Employees` мапится автоматически по имени.
- `ApplyOrderDenormalizedFields`: добавить
  `destination.UserPreferredLanguage = source.User.PreferredLanguage;` внутрь существующей
  проверки `source.User is not null`.

### A.8. `OrderInfo` и `GetAssignedToMe`

Файл: `ATTours.Service/Services/InfoServices/OrderInfo.cs` — **изменить**.

В `GetEntityQueryableRepository()` заменить
`.Include(Lines).ThenInclude(line => line.Employee)` на
```csharp
.Include((Expression<Func<Order, ICollection<OrderLine>>>)(x => x.Lines))
    .ThenInclude(line => line.Employees)
        .ThenInclude(assignment => assignment.Employee)
```
`AsSplitQuery()` уже стоит — это третья коллекция в коллекции, оставить обязательно.

`GetByEmployeeAsync` — **изменить** предикат:
```csharp
.Where(order => order.Lines.Any(line => line.Employees.Any(a => a.EmployeeId == employeeId)))
```

Известное ограничение, **сознательно вне скоупа**: `GetAssignedToMe` отдаёт заказ целиком,
и теперь в `Lines[].Employees[]` сотрудник увидит и коллег по брони с их деталями. Это то же
самое переизбыточное раскрытие, что уже зафиксировано в аудите (см. память проекта, IDOR в
`GetAssignedToMe`) — здесь оно не расширяется на чужие заказы и отдельно не чинится.

### A.9. PDF

Файл: `ATTours.Service/Services/PdfServices/OrderPdfService.cs` — **изменить**.

```csharp
// employeeId != null -> "Задание исполнителю": в блок деталей попадает ТОЛЬКО его карточка.
public static byte[] GenerateAssignmentDocument(OrderInfoModel order,
    IReadOnlyCollection<int> lineIds, int? employeeId = null)
```
- `ComposeLine` в режиме `isAssignment`: вместо плоских `line.PickupDetails/NavigatorLink`
  перебрать `line.Employees` (отфильтрованные по `employeeId`, если он задан) и по каждому
  вывести подпись `«{ФИО} — {роль}»` + условные `Место встречи` / `Навигатор` / `Комментарий`.
- Условие вывода — существующий паттерн `if (!string.IsNullOrWhiteSpace(...))`; пустое поле
  не печатается вовсе. `Comment` — RU-версия (`CommentEn` в PDF не используется: PDF остаётся
  русским, локализация PDF вне скоупа).
- В режиме `!isAssignment` строка «Исполнитель: …» превращается в перечисление всех
  исполнителей строки через запятую (`ФИО (роль)`); пустой список — строка не печатается.

---

## ЧАСТЬ B — Билингвальность

### B.1. `User.PreferredLanguage`

Файл: `ATTours.Common/Entities/User.cs` — **изменить**. Рядом с `DefaultJobRole`:

```csharp
// Язык писем этого пользователя (редизайн 2026-08-23). Non-nullable с дефолтом Russian:
// "языка нет" — не состояние, письмо всё равно должно на чём-то уйти, и RU это текущее
// фактическое поведение. Отдельного enum не заводим — переиспользуется LanguageCode,
// которым уже размечен весь переводимый контент сайта.
public LanguageCode PreferredLanguage { get; set; } = LanguageCode.Russian;
```

**Решено: переиспользовать `LanguageCode` (Russian=1, English=2), а не новый enum.**
Обоснование: набор языков в проекте один и уже задан; второй параллельный enum создал бы
две правды при добавлении третьего языка.

Конфигурация `UserConfiguration` — ничего дописывать не нужно (int по конвенции). Дефолт
задаётся в миграции (`defaultValue: 1`), чтобы существующие строки получили RU.

DTO — **изменить** обе проекции:
- `ATTours.Common/DTO/Auth/UserInfoModel.cs`: `public LanguageCode PreferredLanguage { get; set; }`
- `ATTours.Common/DTO/Auth/UserDetailInfoModel.cs`: то же поле.

Маппинг — автоматический по имени (как `DefaultJobRole`), `ForMember` не требуется.

### B.2. Эндпоинт установки языка

Файл: `ATTours.Common/DTO/Request/SetUserPreferredLanguageModel.cs` — **создать**.
```csharp
public class SetUserPreferredLanguageModel
{
    public int UserId { get; set; }
    public LanguageCode PreferredLanguage { get; set; }   // non-nullable
}
```

Файл: `ATTours.Service/Services/UpdateServices/UserPreferredLanguageUpdateService.cs` —
**создать**. Точная копия структуры `UserJobRoleUpdateService`:
```csharp
public class UserPreferredLanguageUpdateService : RepositoryCoreBase<User, ATToursContextFactory>
{
    public Task<User> UpdateLanguageAsync(int userId, LanguageCode language);
}
```
Логика: `Include(x => x.Role)`, `!IsDeleted`, иначе `RelationalEntityNotFound`/404.
Значение вне диапазона enum **ошибкой не отбивается**: `!Enum.IsDefined(language)` ⇒
записать `LanguageCode.Russian` + `LogWarning`. **Решено так, а не новым кодом ошибки:**
язык — не бизнес-инвариант (в отличие от роли исполнителя, где 400 защищает от назначения
без роли), у него есть безопасный дефолт, и заводить ради него `GlobalErrorCode` значит
плодить код, который никогда не долетит до фронта. Новых кодов ошибок здесь не добавлять.

Файл: `ATTours.ClientAPI/Controllers/UsersController.cs` — **изменить**. Добавить по образцу
`SetJobRoleAsync`:
```csharp
[HttpPatch]
[Route("SetPreferredLanguage")]
public async Task<UserInfoModel> SetPreferredLanguageAsync(
    [FromBody] SetUserPreferredLanguageModel model, CancellationToken cancellationToken)
```
Гейт прав — тот же атрибут, что у соседнего `SetJobRole`.

### B.3. `EmailTemplate` — EN-версии

Файл: `ATTours.Common/Entities/EmailTemplate.cs` — **изменить**:
- **удалить** `IsEnabled` (переезжает в `NotificationChannel`, §C.2);
- **добавить**:
  ```csharp
  // EN-версии. Nullable: пустое поле = "перевод не сделан", письмо тогда уходит RU-версией
  // (§B.4). Санитизация BodyHtmlEn — та же, что у BodyHtml (ADR 026).
  public string SubjectEn { get; set; }
  public string BodyHtmlEn { get; set; }
  ```

Файл: `ATTours.Common/Infrastructure/EntityConfiguration/EmailTemplateConfiguration.cs` —
**изменить**: `Property(x => x.SubjectEn).HasMaxLength(300);` (без `IsRequired`),
`Property(x => x.BodyHtmlEn);` (nvarchar(max), без `IsRequired`). Существующие настройки
`Subject`/`BodyHtml`/уникального индекса не трогать.

### B.4. Правило выбора языка при рендере

Единая функция внутри `OrderNotificationService`:

```
subject = (lang == English && !IsNullOrWhiteSpace(template.SubjectEn))  ? template.SubjectEn  : template.Subject
body    = (lang == English && !IsNullOrWhiteSpace(template.BodyHtmlEn)) ? template.BodyHtmlEn : template.BodyHtml
```

Фолбэк — **по каждому полю независимо** (тема может быть переведена, тело ещё нет).
Warning при пустом EN **не писать**: незаполненный перевод — легальное состояние, а не
ошибка конфигурации (в отличие от неизвестного плейсхолдера).

Язык получателя (§D.3):

| Источник получателя | Язык |
| --- | --- |
| `User` (конкретный пользователь из списка) | `user.PreferredLanguage` |
| `OrderLinked = Client` | `order.UserPreferredLanguage` |
| `OrderLinked = Employee` | `employee.PreferredLanguage` |
| `CustomEmail` (свободный ввод, `User` нет) | **всегда `Russian`** (решение Давида, п.4 чек-листа) |
| `AdminMailbox` (системный ящик из конфига) | **всегда `Russian`** |

### B.5. Билингвальные блоки, которые строит бэкенд

`{{AssignmentDetails}}` и `{{OrderLines}}` собираются кодом, значит их подписи полей тоже
должны быть на языке письма. Обе функции получают параметр `LanguageCode language`.

Файл: `ATTours.Service/Notifications/NotificationLabels.cs` — **создать**. Статический
словарь подписей, по образцу `EmployeeJobRoleExtensions.ToRussianLabel`:

| Токен | RU | EN |
| --- | --- | --- |
| Tour | Тур | Tour |
| Date | Дата | Date |
| Guests | гостей | guests |
| Pickup | Место встречи | Pickup |
| Navigator | Навигатор | Navigator |
| Comment | Комментарий | Comment |
| Role | Роль | Role |

Плюс `EmployeeJobRoleExtensions` — **изменить**: добавить
`public static string ToLabel(this EmployeeJobRole role, LanguageCode language)`
(EN: `Driver`/`Guide`/`Driver-guide`). Существующий `ToRussianLabel()` оставить (его
использует PDF) и реализовать через новый метод.

Формат даты: RU — `dd.MM.yyyy` (culture `ru-RU`, как сейчас), EN — `dd MMM yyyy`
(culture `en-US`).

---

## ЧАСТЬ C — Модель настраиваемых получателей

### C.1. Новые enum'ы

Все — в `ATTours.Common/Enums/`, **создать**:

```csharp
// NotificationPlatform.cs
// Канал доставки уведомления. Telegram в этой задаче — только модель и настройки:
// реальной отправки нет (§0.3).
public enum NotificationPlatform
{
    Email = 1,
    Telegram = 2
}
```
```csharp
// NotificationRecipientType.cs
// Роль адреса в письме. Только для Email: у Telegram копий/скрытых копий не бывает.
public enum NotificationRecipientType
{
    To = 1,
    Cc = 2,
    Bcc = 3
}
```
```csharp
// NotificationRecipientSource.cs
// Откуда берётся адрес получателя. Дискриминатор одной таблицы NotificationRecipient.
public enum NotificationRecipientSource
{
    User = 1,           // конкретный пользователь системы (FK)
    OrderLinked = 2,    // роль, привязанная к заказу (клиент / исполнитель)
    CustomEmail = 3,    // произвольный адрес, введённый руками
    AdminMailbox = 4    // системный ящик из конфигурации (Email:AdminNotificationEmail)
}
```
```csharp
// OrderLinkedRecipient.cs
// Закрытый список ролей, привязанных к заказу. Админ сюда НЕ входит: он выбирается
// обычной строкой-получателем с источником User (решение Давида, п.5 чек-листа).
public enum OrderLinkedRecipient
{
    Client = 1,
    Employee = 2
}
```

**Решено: заведён четвёртый источник `AdminMailbox`, которого нет в чек-листе.** Обоснование:
сегодняшний получатель письма о новой брони — `EmailSettings.AdminNotificationEmail`, а он
в `appsettings.json` **не задан** и падает в фолбэк `FromEmail`, который в проде и в dev
**разный** (`<EMAIL_FROM>` / `no-reply@haytravel.local`). Захардкодить один адрес
в сид миграции — значит изменить поведение в одной из сред (то, чего чек-лист требует
избежать), а читать конфигурацию из миграции нельзя. `AdminMailbox` резолвится на отправке
из того же `EmailSettings.AdminNotificationEmail`, поэтому сид точен в любой среде. В UI это
обычная строка грида, которую админ может выключить или заменить на явный `CustomEmail`;
адрес показывается read-only.

### C.2. Сущность `NotificationChannel` — рубильник (событие × платформа)

Файл: `ATTours.Common/Entities/NotificationChannel.cs` — **создать**.

```csharp
// Включена ли доставка события по этой платформе. Ровно одна строка на пару
// (EventKey, Platform) — 4 события x 2 платформы = 8 строк, засеяны миграцией.
[EntityTypeConfiguration(typeof(NotificationChannelConfiguration))]
public class NotificationChannel : EntityBase
{
    public EmailActionKey EventKey { get; set; }
    public NotificationPlatform Platform { get; set; }
    public bool IsEnabled { get; set; }
}
```

**Решено: рубильник переезжает из `EmailTemplate.IsEnabled` в отдельную таблицу.**
Обоснование: рубильник теперь принадлежит паре «событие × платформа», а не шаблону письма —
у Telegram шаблона нет вовсе, и держать его тумблер в таблице email-шаблонов было бы
неправдой. Оставить `EmailTemplate.IsEnabled` для Email и завести отдельное хранилище для
Telegram — две разные механики для одного и того же чекбокса в одном и том же гриде
«Платформы». Одна таблица — один смысл.

Конфигурация: `NotificationChannelConfiguration` — `ToTable(nameof(NotificationChannel))`,
`HasIndex(x => new { x.EventKey, x.Platform }).IsUnique()`.

### C.3. Сущность `NotificationRecipient`

Файл: `ATTours.Common/Entities/NotificationRecipient.cs` — **создать**.

```csharp
// Один настраиваемый получатель одного события по одной платформе. Единственный источник
// правды о том, кому уходит письмо: зашитая в код логика (админ/исполнитель/клиент)
// удалена. Ноль активных строк у события -> письмо не уходит вообще (осознанное
// поведение, не баг).
[EntityTypeConfiguration(typeof(NotificationRecipientConfiguration))]
public class NotificationRecipient : EntityBase
{
    public EmailActionKey EventKey { get; set; }
    public NotificationPlatform Platform { get; set; }

    public bool IsActive { get; set; }

    // To/Cc/Bcc. Только для Platform.Email; у Telegram всегда null (валидация §E.5).
    public NotificationRecipientType? Type { get; set; }

    // Дискриминатор: ровно одно из полей ниже осмысленно.
    public NotificationRecipientSource SourceType { get; set; }

    // SourceType == User
    public int? UserId { get; set; }
    public User User { get; set; }

    // SourceType == OrderLinked
    public OrderLinkedRecipient? OrderLinkedRole { get; set; }

    // SourceType == CustomEmail
    public string CustomEmail { get; set; }

    // Порядок строк в гриде админки. Не влияет на отправку.
    public int SortOrder { get; set; }
}
```

**Решено: одна таблица со всеми source-полями nullable + дискриминатор `SourceType`,
без EF-наследования (TPH/TPT).** Обоснование:
- В кодовой базе **нет ни одного** случая EF-наследования; ближайший аналог —
  `SiteSetting` с дискриминатором `SettingValueType` и разными смыслами одной колонки
  ([ADR 002](adr/002-site-settings-metadata-in-code-catalog.md)). Идти против сложившейся конвенции
  ради трёх вариантов из 1-2 полей каждый — лишняя сложность.
- Вариантов ровно 4, набор закрыт (как и набор событий), новые источники не планируются.
- Грид админки редактирует строки декларативно (полная замена набора, §E.4) — иерархия
  типов там ничего бы не упростила.

Конфигурация: `NotificationRecipientConfiguration` — **создать**.
```csharp
builder.ToTable(nameof(NotificationRecipient));

// SetNull, а не Cascade/Restrict: удаление (soft-delete) пользователя не должно ни ронять
// сохранение, ни молча уносить настройку — строка останется, но перестанет резолвиться
// (резолвер пропускает строки без адреса, §D.3).
builder.HasOne(x => x.User)
    .WithMany()
    .HasForeignKey(x => x.UserId)
    .OnDelete(DeleteBehavior.SetNull);

builder.Property(x => x.CustomEmail).HasMaxLength(320);   // RFC-максимум адреса

// Чтение всегда идёт срезом "событие + платформа".
builder.HasIndex(x => new { x.EventKey, x.Platform });
```
Уникальных индексов на состав получателей **не ставить**: две строки на одного и того же
пользователя с разными `Type` (например, To и Bcc) — вырожденный, но не запрещённый случай,
а БД-констрейнт на «дубль по источнику» потребовал бы filtered-индексов на каждый вариант
дискриминатора. Проверку дублей делает валидация (§E.5).

Файл: `ATTours.DataLayer/ATToursContext.cs` — **изменить**: добавить
`DbSet<NotificationChannel>` и `DbSet<NotificationRecipient>`.

### C.4. Что происходит с хардкодом получателей

Файл: `ATTours.Service/Notifications/OrderNotificationService.cs` — **изменить**. Полностью
удаляются:
- `emailSettings.AdminNotificationEmail` как получатель `SendOrderCreatedAsync`
  (переезжает в сид `AdminMailbox`, §F.2);
- параметры `employeeEmail`/`employeeName` в `SendAssignmentAsync`/`SendUnassignmentAsync`
  (получатель теперь резолвится, а исполнители приходят контекстом);
- `order.UserEmail` как получатель `SendOrderDocumentAsync`.

`EmailSettings.AdminNotificationEmail` **остаётся** в коде — его читает резолвер источника
`AdminMailbox`. Удалять ключ из `EmailSettings` **нельзя**.

---

## ЧАСТЬ D — Резолвинг получателей и отправка

### D.1. Что читает резолвер

Файл: `ATTours.Service/Services/InfoServices/NotificationSettingsInfo.cs` — **создать**.
Образец — `EmailTemplateInfo` (`EntityInfoBase<T>`, три конструктора: пустой,
`(connectionString, ct)`, `(IApplicationDbContext, ct)`).

```csharp
public class NotificationSettingsInfo : EntityInfoBase<NotificationRecipient>
{
    // Активные получатели одного события по одной платформе, с подгруженным User
    // (нужен Email + PreferredLanguage).
    public Task<List<NotificationRecipient>> GetActiveRecipientsAsync(EmailActionKey key,
        NotificationPlatform platform);

    // Все строки события по всем платформам (для админского GET, включая неактивные).
    public Task<List<NotificationRecipient>> GetRecipientsByEventAsync(EmailActionKey key);

    public Task<List<NotificationRecipient>> GetAllRecipientsAsync();

    // Каналы читаются через тот же контекст: Context.Set<NotificationChannel>().
    public Task<List<NotificationChannel>> GetChannelsAsync(EmailActionKey? key = null);
    public Task<bool> IsChannelEnabledAsync(EmailActionKey key, NotificationPlatform platform);
}
```
`GetEntityQueryableRepository()` переопределить с `.Include(x => x.User)`.

### D.2. Контекст события

Файл: `ATTours.Service/Notifications/OrderNotificationContext.cs` — **создать**.

```csharp
// Всё, что известно о конкретном срабатывании события. Резолверу нужен и заказ (для
// order-linked получателей), и явный список исполнителей ЭТОГО вызова — из заказа его
// не вывести: при снятии исполнителей в строках уже нет, а при назначении письмо должно
// уйти только назначенным сейчас, а не всем, кто был на заказе раньше.
public class OrderNotificationContext
{
    public OrderInfoModel Order { get; set; }

    // Исполнители, к которым относится это событие. Для OrderCreated/OrderSendToClient
    // заполняется сервисом самостоятельно (§D.3), для Assign/Unassign приходит из
    // результата операции.
    public List<OrderEmployeeRecipient> Employees { get; set; } = [];
}
```

### D.3. Алгоритм резолвинга — точно

Файл: `ATTours.Service/Notifications/NotificationRecipientResolver.cs` — **создать**.

```csharp
public sealed class ResolvedRecipient
{
    public string Address { get; init; }
    public string Name { get; init; }
    public NotificationRecipientType Type { get; init; }      // для Email
    public LanguageCode Language { get; init; }

    // Не null только у персональных писем исполнителю: у такого письма своё тело
    // (свои детали) и своё вложение, поэтому в общую рассылку оно не сливается (§D.4).
    public OrderEmployeeRecipient Employee { get; init; }
}

public class NotificationRecipientResolver
{
    public Task<List<ResolvedRecipient>> ResolveAsync(EmailActionKey key,
        NotificationPlatform platform, OrderNotificationContext context,
        CancellationToken cancellationToken);
}
```

Шаги:
1. `IsChannelEnabledAsync(key, platform)` → `false` ⇒ вернуть пустой список (тихий no-op).
2. `GetActiveRecipientsAsync(key, platform)` — упорядочить по `SortOrder`, затем `Id`.
3. Развернуть каждую строку:

| `SourceType` | Правило разворота |
| --- | --- |
| `User` | `UserId == null` или `User.IsDeleted` или пустой `User.Email` ⇒ **пропустить строку** (`LogWarning` один раз с `Id` строки). Иначе 1 адресат: `User.Email`, `"FirstName LastName"`, `User.PreferredLanguage`. |
| `AdminMailbox` | 1 адресат: `EmailSettings.AdminNotificationEmail`, имя `EmailSettings.FromName`, язык `Russian`. Пустой адрес ⇒ пропустить + `LogWarning`. |
| `CustomEmail` | Пустой/пробельный ⇒ пропустить + `LogWarning`. Иначе 1 адресат: адрес как есть, имя = адрес, язык `Russian`. |
| `OrderLinked = Client` | Пустой `Order.UserEmail` ⇒ пропустить. Иначе 1 адресат: `Order.UserEmail`, `Order.UserFullName`, `Order.UserPreferredLanguage`. |
| `OrderLinked = Employee` | `context.Employees` пуст ⇒ **ноль адресатов** (не ошибка). Иначе **по одному адресату на каждый элемент** `context.Employees`, с `Employee = элемент`, языком `элемент.PreferredLanguage`, `Type` — принудительно `To` (см. ниже). |

4. Дедупликация: если один и тот же `Address` пришёл из нескольких строк — оставить
   **первый** (наименьший `SortOrder`), остальные отбросить. Персональные письма исполнителям
   (`Employee != null`) в дедупликацию **не входят** — у них разные тела.

**Решено: у order-linked `Employee` поле `Type` игнорируется, адресат всегда `To`.**
Обоснование: письмо исполнителю персональное (его детали, его PDF) — поставить такого
получателя в Cc/Bcc чужого письма нельзя, не показав ему чужие данные. В UI колонка `Type`
для этой строки должна быть disabled — это требование к Фазе 3, бэкенд просто не читает
значение.

**Резолвинг «Исполнитель заказа» по событиям — итог:**

| Событие | Чем наполняется `context.Employees` |
| --- | --- |
| `OrderAssignEmployee` | `OrderAssignEmployeeResult.Assigned` — только назначенные **этим вызовом**; у каждого `LineIds` = строки этого вызова. |
| `OrderUnassignEmployee` | `OrderUnassignEmployeeResult.Unassigned` — только снятые **этим вызовом** (данные захвачены до удаления). |
| `OrderSendToClient` | Все **текущие** исполнители заказа: `order.Lines.SelectMany(l => l.Employees)`, сгруппировать по `EmployeeId`, `LineIds` = все его строки, роль — с первой строки группы. Собирает сам `OrderNotificationService`. |
| `OrderCreated` | Пустой список: в момент создания брони исполнителей нет. Строка-получатель «Исполнитель заказа» на этом событии просто ни во что не резолвится. |

Язык каждого исполнителя — `OrderEmployeeRecipient.PreferredLanguage`. Assign/Unassign-сервисы
читают его из `User.PreferredLanguage` и кладут в свой результат.

Для `OrderSendToClient` список исполнителей собирает сам `OrderNotificationService` —
**через `OrderInfo` (сущности), а не через `OrderInfoModel`**: `Employee` уже включён в граф
(§A.8), и язык берётся из `assignment.Employee.PreferredLanguage`. **Решено так, а не
добавлением языка в `OrderLineEmployeeInfoModel`:** `PreferredLanguage` — внутреннее поле
доставки писем, отдавать его в админский DTO строки заказа незачем.

### D.4. Группировка и отправка

Одно срабатывание события может дать письма на разных языках и с разными телами. Порядок:

1. Разделить `ResolvedRecipient` на две группы: **персональные** (`Employee != null`) и
   **общие** (`Employee == null`).
2. **Персональные**: по одному письму на каждого. Язык — его. Плейсхолдеры
   `{{EmployeeName}}`/`{{EmployeeRole}}` — его. `{{AssignmentDetails}}` — только его карточки
   деталей по его `LineIds`. Вложение — PDF, собранный по его `LineIds` c `employeeId`
   (§A.9). `To` = он один, `Cc`/`Bcc` пустые.
3. **Общие**: сгруппировать по `Language`. Одно письмо на языковую группу:
   - `To` = адреса группы с `Type == To`; `Cc` — с `Cc`; `Bcc` — с `Bcc`;
   - если в группе нет ни одного `To` — **перевести `Cc` в `To`** (и очистить `Cc`);
   - если после этого `To` всё ещё пуст (были только `Bcc`) — `To` = `EmailSettings.FromEmail`,
     `Bcc` оставить как есть;
   - `{{EmployeeName}}`/`{{EmployeeRole}}` — перечисление всех `context.Employees` через
     запятую (`ФИО (роль)`); пустой список ⇒ пустая строка;
   - `{{AssignmentDetails}}` — карточки **всех** `context.Employees` по всем их строкам;
   - вложение — PDF по объединению всех `LineIds` контекста (для `OrderSendToClient` —
     `GenerateOrderDocument`, как сейчас).
4. Ноль писем на выходе — нормальный результат, ошибки не бросать, `LogInformation` не
   обязателен.

**Решено: язык определяет разбиение на письма; Cc/Bcc не смешивают языки.** Обоснование:
одно письмо не может быть одновременно на двух языках, а «взять язык первого To» отправило бы
англоязычному в копии русский текст. Разбиение по языку — единственный вариант, при котором
и Cc/Bcc остаются осмысленными, и каждый получает свой язык.

### D.5. Новый контракт `IOrderNotificationService`

Файл: `ATTours.Service/Notifications/IOrderNotificationService.cs` — **изменить**.

```csharp
public interface IOrderNotificationService
{
    Task SendOrderCreatedAsync(OrderInfoModel order, CancellationToken cancellationToken = default);

    // assigned — исполнители, назначенные ЭТИМ вызовом (OrderAssignEmployeeResult.Assigned).
    // PDF сервис собирает сам: у каждого исполнителя своё вложение (§D.4).
    Task SendAssignmentAsync(OrderInfoModel order, IReadOnlyCollection<OrderEmployeeRecipient> assigned,
        CancellationToken cancellationToken = default);

    Task SendUnassignmentAsync(OrderInfoModel order, IReadOnlyCollection<OrderEmployeeRecipient> unassigned,
        CancellationToken cancellationToken = default);

    Task SendOrderDocumentAsync(OrderInfoModel order, CancellationToken cancellationToken = default);
}
```

**Решено: генерация PDF переезжает из контроллера в notification-сервис.** Обоснование:
вложение перестало быть одним на вызов — оно зависит от того, кому уходит конкретное письмо
(персональное задание исполнителю ≠ общий документ заказа). Контроллер про получателей теперь
не знает вообще, значит и решить, какие PDF нужны, не может. `OrderPdfService` — статический
класс того же проекта, слои не нарушаются.

DI не меняется: `IOrderNotificationService` остаётся `Scoped`
(`DependencyInjectionConfiguration.AddServices`). `NotificationRecipientResolver` и
`NotificationSettingsInfo` создаются внутри сервиса через `new` — обычный паттерн info-сервисов
проекта.

### D.6. Скрытие пустых полей в письме (баг относительно нового правила)

Файл: `ATTours.Service/Notifications/OrderNotificationService.cs`,
`BuildAssignmentDetailsHtml` — **изменить**.

Сейчас пустое поле подменяется заглушкой:
```csharp
var pickup = string.IsNullOrWhiteSpace(line.PickupDetails) ? "не указано" : line.PickupDetails;
var navigator = string.IsNullOrWhiteSpace(line.NavigatorLink) ? "не указан" : line.NavigatorLink;
```
Правило чек-листа (п.3): незаполненное поле **не появляется нигде**. Заглушки удалить,
строку выводить только при непустом значении — тот же паттерн, что уже применяет
`OrderPdfService.ComposeLine` (`if (!string.IsNullOrWhiteSpace(...))`).

Новая форма блока (по каждой строке заказа, по каждому исполнителю из `LineIds`):

```
<p>
  {Tour}: <тур>                                  — всегда
  <br>{Date}: <дата>, {Guests}: <n>              — всегда
  <br>{Role}: <роль исполнителя>                 — всегда
  <br>{Pickup}: <...>                            — только если непусто
  <br>{Navigator}: <...>                         — только если непусто
  <br>{Comment}: <Comment или CommentEn>         — только если непусто
</p>
```
- Подписи — из `NotificationLabels` по языку письма (§B.5).
- `Comment` для EN-письма: `CommentEn`, если непуст, иначе `Comment`, иначе поле не выводится.
- Значения по-прежнему `WebUtility.HtmlEncode`-ятся (блок вставляется как raw HTML).
- `BuildOrderLinesHtml` — так же параметризовать языком; состав полей не менять.

---

## ЧАСТЬ E — Контракты API

### E.1. `OrderController` — назначение/снятие

Файл: `ATTours.ClientAPI/Controllers/OrderController.cs` — **изменить**.

`AssignEmployeeAsync`: маршрут/атрибуты не менять. Тело:
```csharp
OrderAssignEmployeeResult assignment;
using (var assignService = new OrderAssignEmployeeService(cancellationToken))
    assignment = await assignService.AssignAsync(model);

if (model.SendEmail)
{
    using var info = new OrderInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
    var orderDto = mapper.Map<OrderInfoModel>(await info.GetByIdAsync(model.OrderId, cancellationToken));
    await notificationService.SendAssignmentAsync(orderDto, assignment.Assigned, cancellationToken);
}

foreach (var employee in assignment.Assigned)
    await OrderEventLog.LogEmployeeAssignedAsync(model.OrderId, User.GetUserId(), employee.FullName,
        employee.LineIds, model.LineId is null, cancellationToken);
```
Генерацию PDF из контроллера **удалить** (§D.5). Журнал — **по одной записи на сотрудника**
(сигнатуру `LogEmployeeAssignedAsync` не менять).

`UnassignEmployeeAsync`: аналогично — один вызов
`notificationService.SendUnassignmentAsync(orderDto, unassignment.Unassigned, ct)` вместо
цикла с письмами, журнал по-прежнему циклом по `Unassigned`. Ранний `return` при
`UnassignedLineIds.Count == 0` сохранить.

`SendToClientAsync`: убрать `OrderPdfService.GenerateOrderDocument` и передачу `pdfDocument`;
вызывать `notificationService.SendOrderDocumentAsync(orderDto, ct)`.

`CreateAsync`: без изменений.

### E.2. Правка «деталей для выполнения» — новый эндпоинт

Файл: `ATTours.Common/DTO/Request/OrderLineUpdateModel.cs` — **изменить**: удалить
`PickupDetails` и `NavigatorLink` (остаются `Id`, `RequiresPrepayment`, `PrepaymentAmount`).
`OrderLineService.UpdateLineAsync` — **изменить**: убрать присваивание этих двух полей.

Файл: `ATTours.Common/DTO/Request/OrderLineEmployeeUpdateModel.cs` — **создать**.
```csharp
// Карточка деталей одного исполнителя на одной строке (OrderFulfillmentTab, Фаза 3).
// Роль здесь НЕ правится — это делает Assign (upsert, §A.4).
public class OrderLineEmployeeUpdateModel
{
    public int Id { get; set; }              // Id строки OrderLineEmployee
    public string PickupDetails { get; set; }
    public string NavigatorLink { get; set; }
    public string Comment { get; set; }
    public string CommentEn { get; set; }
}
```

Файл: `ATTours.Service/Services/UpdateServices/OrderLineEmployeeUpdateService.cs` — **создать**.
Образец — `OrderLineService.UpdateLineAsync` (точечная правка скаляров одной строки).
```csharp
public class OrderLineEmployeeUpdateService : RepositoryCoreBase<Order, ATToursContextFactory>
{
    // Возвращает OrderId — контроллеру нужен для журнала.
    public Task<int> UpdateAsync(OrderLineEmployeeUpdateModel model);
}
```
Нет строки → `ErrorModelException(GlobalErrorCode.OrderLineEmployeeNotFound, 404)` (новый код,
§E.6).

Файл: `ATTours.ClientAPI/Controllers/OrderController.cs` — **изменить**, добавить:
```csharp
[HttpPut]
[Route("UpdateLineEmployee")]
[RequiresPermission(AdminScreens.Orders, PermissionAction.Update)]
public async Task UpdateLineEmployeeAsync([FromBody] OrderLineEmployeeUpdateModel model,
    CancellationToken cancellationToken)
```
После сохранения — `OrderEventLog.LogLineUpdatedAsync(...)` (отдельного типа события не
заводить: для журнала это правка строки заказа).

### E.3. DTO раздела «Настройки уведомлений»

Все — в `ATTours.Common/DTO/Info/` и `ATTours.Common/DTO/Request/`, **создать**.

```csharp
// Info: одно событие целиком — то, что открывается по клику на строку грида "Событие".
public class NotificationEventInfoModel
{
    public EmailActionKey EventKey { get; set; }
    public string DisplayName { get; set; }                       // из EmailPlaceholders
    public List<NotificationPlatformInfoModel> Platforms { get; set; } = [];
}

public class NotificationPlatformInfoModel
{
    public NotificationPlatform Platform { get; set; }
    public bool IsEnabled { get; set; }

    // false у Telegram: канал настраивается, но отправки пока нет (§0.3). Фронт этим
    // помечает вкладку, бэкенд — не шлёт.
    public bool IsImplemented { get; set; }

    // Только у Email; у Telegram null.
    public NotificationTemplateInfoModel Template { get; set; }

    public List<NotificationRecipientInfoModel> Recipients { get; set; } = [];
}

public class NotificationTemplateInfoModel
{
    public string Subject { get; set; }
    public string SubjectEn { get; set; }
    public string BodyHtml { get; set; }
    public string BodyHtmlEn { get; set; }
    public List<string> AvailablePlaceholders { get; set; } = [];   // уже в {{ }}
}

public class NotificationRecipientInfoModel
{
    public int Id { get; set; }
    public bool IsActive { get; set; }
    public NotificationRecipientType? Type { get; set; }
    public NotificationRecipientSource SourceType { get; set; }

    public int? UserId { get; set; }
    public string UserFullName { get; set; }      // денормализация, AfterMap
    public string UserEmail { get; set; }         // денормализация, AfterMap

    public OrderLinkedRecipient? OrderLinkedRole { get; set; }
    public string CustomEmail { get; set; }
    public int SortOrder { get; set; }
}
```

```csharp
// Request: сохранение одного события целиком (декларативно).
public class NotificationEventUpdateModel
{
    public EmailActionKey EventKey { get; set; }
    public List<NotificationPlatformUpdateModel> Platforms { get; set; } = [];
}

public class NotificationPlatformUpdateModel
{
    public NotificationPlatform Platform { get; set; }
    public bool IsEnabled { get; set; }

    // Только для Email; для Telegram игнорируются.
    public string Subject { get; set; }
    public string SubjectEn { get; set; }
    public string BodyHtml { get; set; }
    public string BodyHtmlEn { get; set; }

    // ПОЛНЫЙ набор строк грида: чего нет в списке — удаляется.
    public List<NotificationRecipientUpdateModel> Recipients { get; set; } = [];
}

public class NotificationRecipientUpdateModel
{
    public int? Id { get; set; }                  // null = новая строка
    public bool IsActive { get; set; }
    public NotificationRecipientType? Type { get; set; }
    public NotificationRecipientSource SourceType { get; set; }
    public int? UserId { get; set; }
    public OrderLinkedRecipient? OrderLinkedRole { get; set; }
    public string CustomEmail { get; set; }
    public int SortOrder { get; set; }
}
```

**Решено: PUT сохраняет событие целиком и заменяет набор получателей (declarative sync),
а не отдельные POST/PATCH/DELETE на строку.** Обоснование: экран — редактируемый грид с одной
кнопкой «Сохранить», а не CRUD-список; частичные операции потребовали бы 4 эндпоинта и
согласования порядка вызовов на фронте ради того же результата. Тот же приём уже применён у
`UsersController.PutPermissionOverrides` (полная замена набора overrides).

Файлы `ATTours.Common/DTO/Info/EmailTemplateInfoModel.cs` и
`ATTours.Common/DTO/Request/EmailTemplateUpdateModel.cs` — **удалить**.

### E.4. Контроллер

Файл: `ATTours.ClientAPI/Controllers/EmailTemplateController.cs` — **удалить**.
Файл: `ATTours.ClientAPI/Controllers/NotificationSettingsController.cs` — **создать**.
Стиль — как у удаляемого: `[ApiController]`, `[Route("api/[controller]")]`, `[Authorize]`,
конструктор `(IMapper mapper)`, сервисы через `new` + `using`. Гейт — тот же ключ
`AdminScreens.Notifications`.

| Метод | Маршрут | Тело | Возврат | Назначение |
| --- | --- | --- | --- | --- |
| GET | `api/NotificationSettings` | — | `List<NotificationEventInfoModel>` | все 4 события с платформами, шаблонами и получателями |
| GET | `api/NotificationSettings/{eventKey:int}` | — | `NotificationEventInfoModel` | одно событие; неизвестный ключ → 404 `EmailTemplateInvalid` |
| PUT | `api/NotificationSettings` | `NotificationEventUpdateModel` | `NotificationEventInfoModel` | сохранить событие целиком |

Порядок событий в GET — по возрастанию `EventKey` (как сейчас в `EmailTemplateInfo.GetOrderedAsync`).
Порядок платформ — `Email`, затем `Telegram`.

### E.5. Сервисы раздела

Файл: `ATTours.Service/Services/InfoServices/NotificationSettingsInfo.cs` — **создать**
(контракт в §D.1). Дополнительно метод сборки админской проекции:
```csharp
// Событие + каналы + шаблон + получатели одним чтением. Шаблон берётся через
// EmailTemplateInfo (тот же контекст), каталог плейсхолдеров — из EmailPlaceholders.
public Task<List<NotificationEventView>> GetEventsAsync(EmailActionKey? key = null);
```
`NotificationEventView` — внутренний тип сборки (`ATTours.Service/Notifications/NotificationEventView.cs`),
который маппер разворачивает в `NotificationEventInfoModel`. Держать сборку в Info-сервисе, а
не в контроллере: контроллер не должен сшивать три таблицы.

Файл: `ATTours.Service/Services/ValidationServices/NotificationSettingsValidationService.cs` —
**создать**. Правила (нарушение → `ErrorModelException(GlobalErrorCode.NotificationRecipientInvalid, 400)`,
кроме отдельно указанного):

1. `EventKey` не в `EmailPlaceholders.AllKeys` → `EmailTemplateInvalid`, 400.
2. `Platform` вне enum → `NotificationRecipientInvalid`.
3. Для `Platform.Email`: `Subject` и `BodyHtml` не пустые → иначе `EmailTemplateInvalid`
   (правило существующего `EmailTemplateValidationService` сохраняется). `SubjectEn`/`BodyHtmlEn`
   могут быть пустыми.
4. Для `Platform.Email`: у каждого получателя `Type` **обязателен** и в диапазоне enum.
5. Для `Platform.Telegram`: `Type` должен быть `null`; `SourceType` ∈ { `User`, `OrderLinked` }
   (`CustomEmail`/`AdminMailbox` — email-специфичные источники).
6. `SourceType == User` ⇒ `UserId != null` и пользователь существует и `!IsDeleted`.
7. `SourceType == OrderLinked` ⇒ `OrderLinkedRole != null` и в диапазоне enum.
8. `SourceType == CustomEmail` ⇒ `CustomEmail` непуст и содержит `@` (полноценный
   RFC-валидатор не заводить — в проекте его нет).
9. `SourceType == AdminMailbox` ⇒ `UserId`, `OrderLinkedRole`, `CustomEmail` игнорируются
   (обнуляются при сохранении).
10. Дубли внутри одной платформы: две строки с одинаковой парой (`SourceType`, ключ источника)
    и одинаковым `Type` → ошибка. Ключ источника: `UserId` / `OrderLinkedRole` /
    нормализованный (trim + lower) `CustomEmail` / нет ключа у `AdminMailbox`.

Валидация **не** запрещает событие с нулём активных получателей — это разрешённое состояние
(письмо просто не уходит).

Файл: `ATTours.Service/Services/UpdateServices/NotificationSettingsUpdateService.cs` —
**создать**. Образец — `SiteSettingsUpdateService` (upsert) + `PutPermissionOverrides`
(полная замена набора).
```csharp
public class NotificationSettingsUpdateService : RepositoryCoreBase<NotificationRecipient, ATToursContextFactory>
{
    public Task SaveEventAsync(NotificationEventUpdateModel model);
}
```
Логика (один `SaveChangesAsync` на всё):
1. Валидация (см. выше).
2. По каждой платформе: upsert `NotificationChannel` по `(EventKey, Platform)` → `IsEnabled`.
3. Для `Platform.Email`: upsert `EmailTemplate` по `ActionKey`. `Subject`/`SubjectEn` —
   plaintext (теги вырезать, как сейчас); `BodyHtml`/`BodyHtmlEn` — прогнать через
   существующий `RichHtmlSanitizer` (`ATTours.Service/Html/`) **обе версии одинаково**.
4. Получатели платформы: строки с `Id`, которых нет во входном списке, — удалить; с `Id` —
   обновить; без `Id` — создать.
5. `SaveChangesAsync`.

Файл: `ATTours.Service/Services/UpdateServices/EmailTemplateUpdateService.cs` — **удалить**
(его upsert + санитизация переезжают в `NotificationSettingsUpdateService`; отдельного
эндпоинта правки шаблона больше нет).
Файл: `ATTours.Service/Services/ValidationServices/EmailTemplateValidationService.cs` —
**удалить** (правила 1 и 3 выше поглощают его).
Файл: `ATTours.Service/Services/InfoServices/EmailTemplateInfo.cs` — **изменить**: метод
`GetOrderedAsync()` больше не нужен (его роль у `NotificationSettingsInfo.GetEventsAsync`),
`GetByKeyAsync` остаётся — им пользуется `OrderNotificationService`.

Файл: `ATTours.Common/Constants/EmailPlaceholders.cs` — **изменить**: удалить
`RecipientDescriptions` и метод `RecipientDescription(...)` — описание получателя больше не
константа кода, получатели видны в гриде. `DisplayName`/`TokensFor`/`WrappedTokensFor`/
`AllKeys`/`IsKnown`/`Wrap` — оставить как есть. Состав токенов не менять.

Файл: `ATTours.ClientAPI/Mapper/MappingProfile.cs` — **изменить**: удалить
`CreateMap<EmailTemplate, EmailTemplateInfoModel>` и `ApplyEmailTemplateCatalogMetadata`;
добавить маппинги `NotificationEventView → NotificationEventInfoModel` (с `AfterMap`,
проставляющим `DisplayName` и `AvailablePlaceholders` из `EmailPlaceholders`) и
`NotificationRecipient → NotificationRecipientInfoModel` (`AfterMap` — `UserFullName`/`UserEmail`
из `source.User`, если он не null).

### E.6. Новые коды ошибок

Файл: `ATTours.Helper/Enums/GlobalErrorCode.cs` — **изменить**. В `#region EntityErrors`,
после `InvalidPermissionLevel = 2037`:
```csharp
[Description("Notification recipient configuration is invalid.")]
NotificationRecipientInvalid = 2038,

[Description("Order line employee assignment not found.")]
OrderLineEmployeeNotFound = 2039,
```

### E.7. `IEmailSender` — множественные адресаты

Файл: `ATTours.Service/Email/EmailRecipients.cs` — **создать**.
```csharp
public sealed class EmailAddress
{
    public string Email { get; init; }
    public string Name { get; init; }
}

public sealed class EmailRecipients
{
    public List<EmailAddress> To { get; init; } = [];
    public List<EmailAddress> Cc { get; init; } = [];
    public List<EmailAddress> Bcc { get; init; } = [];
}
```

Файл: `ATTours.Service/Email/IEmailSender.cs` — **изменить**: добавить перегрузку
```csharp
// Письма заказов теперь уходят набору адресатов с копиями (§D.4). Однополучательская
// перегрузка остаётся — ею пользуются auth-сценарии и она проще на вызове.
Task SendTransactionalAsync(EmailRecipients recipients, string subject, string bodyHtml,
    EmailAttachment? attachment = null, CancellationToken cancellationToken = default);
```
Существующий однополучательский `SendTransactionalAsync` **не удалять**.

Файлы `BrevoEmailSender.cs`, `SendGridEmailSender.cs`, `DevEmailSender.cs` — **изменить**:
реализовать новую перегрузку (Brevo: ключи `to`/`cc`/`bcc` — массивы; SendGrid: по его схеме
`personalizations`; Dev: залогировать все три списка). Старую перегрузку свести к вызову новой
с `To` из одного адреса. Пустой `To` в транспорт не отдавать — резолвер это уже гарантирует
(§D.4, п.3).

---

## ЧАСТЬ F — Миграции

Две отдельные миграции: разные фичи, чистая история и независимый откат (тот же принцип, что
у `AddEmployeeJobRole` / `AddEmailTemplates`). Применяются на старте API автоматически.

### F.1. Миграция `OrderLineMultiEmployee`

`Up`:
1. `CreateTable("OrderLineEmployee")`: `Id` (identity), `OrderLineId` int NOT NULL,
   `EmployeeId` int NOT NULL, `EmployeeRole` int NOT NULL, `PickupDetails` nvarchar(max) NULL,
   `NavigatorLink` nvarchar(1000) NULL, `Comment` nvarchar(max) NULL, `CommentEn` nvarchar(max) NULL;
   FK на `OrderLine` (Cascade) и `User` (Restrict).
2. Индексы: `IX_OrderLineEmployee_OrderLineId_EmployeeId` (unique),
   `IX_OrderLineEmployee_EmployeeId`.
3. **Перенос данных** (`migrationBuilder.Sql`), одна строка на каждую существующую непустую
   связку:
   ```sql
   INSERT INTO OrderLineEmployee (OrderLineId, EmployeeId, EmployeeRole, PickupDetails, NavigatorLink, Comment, CommentEn)
   SELECT Id, EmployeeId, ISNULL(EmployeeRole, 3), PickupDetails, NavigatorLink, NULL, NULL
   FROM OrderLine
   WHERE EmployeeId IS NOT NULL;
   ```
   `ISNULL(EmployeeRole, 3)` = `DriverGuide` — **решено**: `EmployeeRole` на новой сущности
   non-nullable, а строки, назначенные до Задачи D, роли не имеют. `DriverGuide` — самая
   широкая роль: она не сужает то, что человек фактически делал на старой броне, тогда как
   `Driver`/`Guide` могли бы соврать.
4. **Сохранение «осиротевших» деталей** — строки, где `EmployeeId IS NULL`, но
   `PickupDetails`/`NavigatorLink` заполнены: перенести их в новую таблицу нельзя (нет
   исполнителя), поэтому перед удалением колонок положить их текстом в журнал заказа:
   ```sql
   INSERT INTO OrderEvent (OrderId, Type, Description, ActorUserId, ActorFullName, CreatedAtUtc)
   SELECT OrderId, 6,
          N'Переход на мульти-исполнителей: детали строки без исполнителя не перенесены. '
          + ISNULL(N'Место встречи: ' + PickupDetails + N'. ', N'')
          + ISNULL(N'Навигатор: ' + NavigatorLink, N''),
          NULL, NULL, GETUTCDATE()
   FROM OrderLine
   WHERE EmployeeId IS NULL
     AND (NULLIF(LTRIM(RTRIM(ISNULL(PickupDetails, N''))), N'') IS NOT NULL
       OR NULLIF(LTRIM(RTRIM(ISNULL(NavigatorLink, N''))), N'') IS NOT NULL);
   ```
   (`Type = 6` = `OrderEventType.LineUpdated`.)
   **Решено так, а не «просто удалить».** Обоснование: детали без исполнителя в новой модели
   адресовать некому, но молча стирать введённые админом данные нельзя. Журнал заказа — уже
   существующая read-only лента, которую админ видит на табе «История»; новой схемы это не
   требует, и данные остаются на виду ровно у того заказа, к которому относились.
5. `DropIndex("IX_OrderLine_EmployeeId")`, `DropForeignKey` на `User`,
   `DropColumn` × 5: `EmployeeId`, `EmployeeRole`, `PickupDetails`, `NavigatorLink`.

`Down`: вернуть 4 колонки на `OrderLine`, залить обратно **по одной (первой по Id) строке
назначения на каждую строку заказа** (при нескольких исполнителях восстановить можно только
одного — это ожидаемая потеря при откате, зафиксировать комментарием), `DropTable`.

### F.2. Миграция `NotificationRecipientsAndBilingualTemplates`

`Up`:
1. `AddColumn User.PreferredLanguage` int NOT NULL `defaultValue: 1`.
2. `AddColumn EmailTemplate.SubjectEn` nvarchar(300) NULL, `EmailTemplate.BodyHtmlEn`
   nvarchar(max) NULL.
3. `CreateTable("NotificationChannel")`: `Id`, `EventKey` int, `Platform` int, `IsEnabled` bit;
   unique-индекс `(EventKey, Platform)`.
4. `CreateTable("NotificationRecipient")`: `Id`, `EventKey` int, `Platform` int, `IsActive` bit,
   `Type` int NULL, `SourceType` int NOT NULL, `UserId` int NULL (FK на `User`, `SetNull`),
   `OrderLinkedRole` int NULL, `CustomEmail` nvarchar(320) NULL, `SortOrder` int NOT NULL;
   индекс `(EventKey, Platform)`.
5. **Сид каналов** — Email-канал наследует текущий тумблер шаблона, чтобы выключённое админом
   осталось выключенным:
   ```sql
   INSERT INTO NotificationChannel (EventKey, Platform, IsEnabled)
   SELECT ActionKey, 1, IsEnabled FROM EmailTemplate;

   INSERT INTO NotificationChannel (EventKey, Platform, IsEnabled)
   SELECT ActionKey, 2, 0 FROM EmailTemplate;   -- Telegram выключен: отправки нет (§0.3)
   ```
6. **Сид получателей** — ровно текущий зашитый в код набор, чтобы поведение не изменилось
   молча (`InsertData`, `Platform = 1`, `IsActive = 1`, `Type = 1` (To), `SortOrder = 0`):

   | EventKey | SourceType | Значение | Соответствует текущему хардкоду |
   | --- | --- | --- | --- |
   | 1 `OrderCreated` | 4 `AdminMailbox` | — | `emailSettings.AdminNotificationEmail` в `SendOrderCreatedAsync` |
   | 2 `OrderAssignEmployee` | 2 `OrderLinked` | `OrderLinkedRole = 2` (Employee) | параметр `employeeEmail` в `SendAssignmentAsync` |
   | 3 `OrderUnassignEmployee` | 2 `OrderLinked` | `OrderLinkedRole = 2` (Employee) | параметр `employeeEmail` в `SendUnassignmentAsync` |
   | 4 `OrderSendToClient` | 2 `OrderLinked` | `OrderLinkedRole = 1` (Client) | `order.UserEmail` в `SendOrderDocumentAsync` |

   Telegram-получателей **не сидить** (канал выключен, отправки нет).
7. `DropColumn EmailTemplate.IsEnabled` — **последним шагом**, после сида каналов (п.5 читает
   эту колонку).

`Down`: вернуть `EmailTemplate.IsEnabled` bit NOT NULL default 1, залить обратно из
`NotificationChannel` (`Platform = 1`), удалить две таблицы и три колонки.

### F.3. Проверка после применения (для `backend-developer`)

Не автотесты, а обязательный ручной чек перед передачей Давиду:
- Число строк `OrderLineEmployee` = число строк `OrderLine` с непустым `EmployeeId` до миграции.
- `SELECT COUNT(*) FROM NotificationChannel` = 8, `NotificationRecipient` = 4.
- Назначение исполнителя в админке → письмо уходит на тот же адрес, что и до миграции.
- Выключение канала Email у события → письмо не уходит, ошибок в ответе API нет.

---

## Сводка «что создать / что изменить / что удалить»

### ATTours.Common
- **создать** `Enums/NotificationPlatform.cs`, `Enums/NotificationRecipientType.cs`,
  `Enums/NotificationRecipientSource.cs`, `Enums/OrderLinkedRecipient.cs`
- **создать** `Entities/OrderLineEmployee.cs`, `Entities/NotificationChannel.cs`,
  `Entities/NotificationRecipient.cs`
- **создать** `Infrastructure/EntityConfiguration/OrderLineEmployeeConfiguration.cs`,
  `NotificationChannelConfiguration.cs`, `NotificationRecipientConfiguration.cs`
- **создать** DTO Info: `OrderLineEmployeeInfoModel.cs`, `NotificationEventInfoModel.cs`,
  `NotificationPlatformInfoModel.cs`, `NotificationTemplateInfoModel.cs`,
  `NotificationRecipientInfoModel.cs`
- **создать** DTO Request: `OrderLineEmployeeUpdateModel.cs`, `NotificationEventUpdateModel.cs`,
  `NotificationPlatformUpdateModel.cs`, `NotificationRecipientUpdateModel.cs`,
  `SetUserPreferredLanguageModel.cs`
- **изменить** `Entities/OrderLine.cs` (−5 полей, +`Employees`), `Entities/User.cs`
  (+`PreferredLanguage`), `Entities/EmailTemplate.cs` (−`IsEnabled`, +`SubjectEn`/`BodyHtmlEn`)
- **изменить** `Infrastructure/EntityConfiguration/OrderLineConfiguration.cs`,
  `EmailTemplateConfiguration.cs`
- **изменить** `DTO/Info/OrderLineInfoModel.cs`, `DTO/Info/OrderInfoModel.cs`
  (+`UserPreferredLanguage`), `DTO/Auth/UserInfoModel.cs`, `DTO/Auth/UserDetailInfoModel.cs`
- **изменить** `DTO/Request/OrderAssignEmployeeModel.cs` (+`Employees` список, −`EmployeeId`/
  `EmployeeRole`), `DTO/Request/OrderUnassignEmployeeModel.cs` (+`EmployeeId?`),
  `DTO/Request/OrderLineUpdateModel.cs` (−`PickupDetails`/`NavigatorLink`)
- **изменить** `Constants/EmailPlaceholders.cs` (−`RecipientDescription`)
- **изменить** `Extensions/EmployeeJobRoleExtensions.cs` (+`ToLabel(language)`)
- **удалить** `DTO/Info/EmailTemplateInfoModel.cs`, `DTO/Request/EmailTemplateUpdateModel.cs`

### ATTours.Helper
- **изменить** `Enums/GlobalErrorCode.cs` (+`NotificationRecipientInvalid = 2038`,
  +`OrderLineEmployeeNotFound = 2039`)

### ATTours.DataLayer
- **изменить** `ATToursContext.cs` (+`DbSet<OrderLineEmployee>`, `DbSet<NotificationChannel>`,
  `DbSet<NotificationRecipient>`)
- **создать** миграции `OrderLineMultiEmployee`, `NotificationRecipientsAndBilingualTemplates`

### ATTours.Service (ATTours.BusinessServices)
- **создать** `Notifications/OrderEmployeeRecipient.cs`, `Notifications/OrderNotificationContext.cs`,
  `Notifications/NotificationRecipientResolver.cs`, `Notifications/NotificationLabels.cs`,
  `Notifications/NotificationEventView.cs`
- **создать** `Services/InfoServices/NotificationSettingsInfo.cs`
- **создать** `Services/UpdateServices/NotificationSettingsUpdateService.cs`,
  `Services/UpdateServices/OrderLineEmployeeUpdateService.cs`,
  `Services/UpdateServices/UserPreferredLanguageUpdateService.cs`
- **создать** `Services/ValidationServices/NotificationSettingsValidationService.cs`
- **создать** `Email/EmailRecipients.cs`
- **изменить** `Notifications/IOrderNotificationService.cs`, `Notifications/OrderNotificationService.cs`
  (резолвинг из БД, билингвальный рендер, группировка по языку, скрытие пустых полей,
  генерация PDF внутри сервиса)
- **изменить** `Services/UpdateServices/OrderAssignEmployeeService.cs` (мультивыбор, upsert),
  `Services/UpdateServices/OrderUnassignEmployeeService.cs` (снятие конкретного исполнителя),
  `Services/UpdateServices/OrderLineService.cs` (−детали из `UpdateLineAsync`)
- **изменить** `Services/InfoServices/OrderInfo.cs` (граф `Employees`, `GetByEmployeeAsync`),
  `Services/InfoServices/EmailTemplateInfo.cs` (−`GetOrderedAsync`)
- **изменить** `Services/PdfServices/OrderPdfService.cs` (перебор исполнителей, `Comment`,
  `employeeId`-фильтр)
- **изменить** `Email/IEmailSender.cs` + `BrevoEmailSender.cs` + `SendGridEmailSender.cs` +
  `DevEmailSender.cs` (перегрузка с `EmailRecipients`)
- **удалить** `Services/UpdateServices/EmailTemplateUpdateService.cs`,
  `Services/ValidationServices/EmailTemplateValidationService.cs`

### ATTours.ClientAPI
- **создать** `Controllers/NotificationSettingsController.cs`
- **изменить** `Controllers/OrderController.cs` (Assign/Unassign/SendToClient под новые
  контракты, +`UpdateLineEmployee`, −генерация PDF)
- **изменить** `Controllers/UsersController.cs` (+`SetPreferredLanguage`)
- **изменить** `Mapper/MappingProfile.cs` (−`EmailTemplate`-маппинг, +`NotificationEventView`,
  +`NotificationRecipient`, +`OrderLineEmployee`, правка `ApplyOrderLineDenormalizedFields` и
  `ApplyOrderDenormalizedFields`)
- **удалить** `Controllers/EmailTemplateController.cs`
- DI — **без изменений** (`IOrderNotificationService` уже `Scoped`)

### ATTours.ContextRepository
- **без изменений**: новых абстракций репозитория не требуется, всё ложится на существующие
  `RepositoryCoreBase`/`EntityInfoBase`.

### Явно вне скоупа
- Реальная отправка в Telegram (бот, токен, chat-id) — только модель и настройки (§0.3).
- Локализация PDF: документ остаётся русским, `CommentEn` в него не попадает.
- Локализация журнала заказа (`OrderEvent.Description`) — остаётся русской.
- Auth-письма: ни билингвальность, ни настраиваемые получатели их не касаются.
- Избыточное раскрытие чужих карточек исполнителей в `GetAssignedToMe` (§A.8) — существующий
  зафиксированный долг, здесь не чинится.
- Весь фронтенд: экран `/admin/notifications`, `OrderFulfillmentTab` по исполнителям, попап
  мультиназначения — Фаза 3 чек-листа, зона фронтенд-`architect`.
- Удаление патерналистских hint-боксов (п.1 чек-листа) — фронтенд.
