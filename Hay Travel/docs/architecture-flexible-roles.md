# Архитектура: гибкая система ролей и прав (роль + персональный override, права по «экранам»)

Проектный документ для backend-developer. Покрывает **Этапы 0.1, 1, 2, 3** чек-листа
`docs/checklists/checklist-flexible-roles.txt` (модель данных, авторизация, API управления
ролями). Заменяет фиксированную ролевую модель (`RoleType`-enum + `[Authorize(Roles=…)]`) на
роли, редактируемые из UI, с матрицей прав по «экранам» и персональными override на пользователя.

Реализовывать строго по этому документу. Все решения по открытым вопросам чек-листа приняты
здесь (см. §0). Реализацию писать по образцу уже существующих вертикальных срезов:
- **CRUD-сущность с матрицей** — по образцу `Tag`/`TagController`/`TagInfo`/`TagCreationService`/
  `TagUpdateService`/`TagDeletionService` (полный CRUD одной сущности).
- **Точечный сервис одного поля** — по образцу `UserRoleUpdateService` (грузит строку, меняет
  скаляр, `SaveChanges`).
- **Резолв + токен** — по образцу `AuthService.LoginAsync`/`RefreshAsync` + `JwtTokenService`.
- **Реестр-в-коде** — по образцу каталога ключей `EmailPlaceholders`/`EmailActionKey` (единый
  статический источник, читаемый и бэкендом, и API-эндпоинтом для фронта).

Границы слоёв, обязательные к соблюдению: бизнес-правила (защита системных ролей, резолв прав,
запрет удаления роли с пользователями) живут в `ATTours.Service`, не в контроллерах и не в
репозиториях. Прямого `DbContext` в контроллерах нет (сервисы через `new` + `using`, как во всём
проекте, кроме auth/notification-вертикали на DI). Реестр экранов и enum действий — в
`ATTours.Common` (их читают и EF-конфигурации, и Service, и ClientAPI).

---

## §0. Решения по открытым вопросам (обоснования)

### 0.1. `User.RoleId` и сущность роли — эволюция `UserRole`, без переименования

**Решение: не заводить новую сущность `Role`, а эволюционировать существующую `UserRole`
(таблица `UserRole`) на месте.** `User.RoleId` остаётся FK на неё как есть.

Обоснование:
- `User.RoleId → UserRole` уже пронизывает `AuthService`, `JwtTokenService`, `UserRoleUpdateService`,
  `UserInfo`, маппинги и сид. Переименование сущности/таблицы — churn в ~10 файлах и rename-миграция
  ради косметики: `UserRole` **и есть** сущность роли.
- API/DTO-слой при этом называется по контракту чек-листа — `api/Roles`, `RoleInfoModel`,
  `RolePermission`. Небольшое расхождение «entity `UserRole` ↔ API `Role`» проект уже терпит
  (контроллер называется `Users`, сущность `User`; роль меняется через `api/Users/ChangeRole`).

Изменения в `UserRole`:
- `Description` (string, required, сейчас держит человекочитаемую метку «Администратор») →
  **переименовать в `Name`** (rename-колонки миграцией). Это и есть отображаемое имя роли в UI.
- Добавить `bool IsSystem` — защита от удаления/переименования типа (см. §0.4).
- `RoleType Type` → сделать **`RoleType? Type` (nullable)**. Системные роли (Regular/TourManager/
  Admin/Employee) сохраняют свой `Type`; кастомные роли имеют `Type = null`. `Type` — **стабильный
  идентификатор системной роли**, не зависящий от переименования `Name` (нужен для жёстко зашитых
  проверок Admin/Employee и SuperAdmin, §0.5).

### 0.2. Резолвинг прав — печём в JWT, переrésolve на каждом refresh (механика форс-применения)

**Решение: права резолвятся из БД ТОЛЬКО в момент выпуска access-токена (login и refresh) и
пекутся в claim токена. На каждый запрос БД не трогаем** — `[RequiresPermission]`-handler читает
права из claim'а (§2.4).

Механика применения изменений (открытый вопрос чек-листа):
- `AuthService.RefreshAsync` уже перечитывает `user` + `Role` из БД на каждой ротации и заново
  зовёт `CreateAccessToken`. Значит, если резолвер прав вызывается там же, **любое изменение прав
  роли/override применяется автоматически при следующем обновлении access-токена** — без действий
  пользователя. Access-токен живёт 15 минут (`JwtSettings.AccessTokenMinutes`), SPA его тихо
  ротирует, поэтому **гарантированная максимальная задержка применения — один TTL access-токена
  (≤15 мин)**, либо мгновенно при перелогине.
- Это ровно та же семантика, что у уже существующей смены роли (`ChangeRole`): она тоже
  «eventual», сессии не гасит. Новая система прав ведёт себя консистентно с ней.
- **Принудительный немедленный форс-релогин (revoke refresh-токенов) в скоуп НЕ входит** —
  сознательно, ради консистентности с текущим `ChangeRole` и чтобы не выкидывать сотрудников из
  сессии на каждый чих правки матрицы. Если в будущем понадобится жёсткий мгновенный отзыв доступа
  — механизм уже есть (`AuthService.RevokeAllRefreshTokensAsync`), его можно точечно позвать из
  update-сервисов ролей/override; это отдельная задача, здесь его не подключаем. Явно вне скоупа
  (§Вне скоупа).

Почему это безопасно при понижении прав: access-токен и так короткоживущий (15 мин), а
свежий всегда резолвится из БД — «залипший» расширенный доступ живёт максимум один TTL.

### 0.3. `SetFeatured`/`SetActive`/`SetArchived` внутри ключа `products`

**Решение: все операции над существующим туром — это `products.Update`.**
- `SetActive`, `SetArchived` → `products.Update` (сохраняет доступ тур-менеджеру, у него будет
  `products.Update` в сиде — как сейчас `TourManagerOrAdmin`).
- `SetFeatured`, `ReorderFeatured` → тоже `products.Update`. Сейчас они `Admin`-only; при
  переезде тур-менеджер их **получает**. Это осознанное, **не радикальное** расширение: тур-менеджер
  и так полностью ведёт контент тура — курирование «избранного» той же природы. Альтернатива
  (оставить featured на жёстко зашитом `Admin`) создала бы единственный tour-эндпоинт вне матрицы
  и сломала бы принцип «всё гейтится матрицей, добавление экрана механическое» (§0.6). Давид по
  этому вопросу мнения не имеет, критерий «не рушить поведение радикально» соблюдён.
- `CreateTour` → `products.Create`; `DeleteTour` → `products.Delete` (остаётся эксклюзивом Admin
  в сиде — у тур-менеджера `Delete` нет, как сейчас); `InitTour`/`InitUpdate`/`GetAll`/`GetArchived`
  → `products.View`.

### 0.4. Удаление роли, на которую назначены пользователи

**Решение: запретить удаление (409 Conflict), пока хоть один не-удалённый пользователь ссылается
на роль. Плюс безусловный запрет удаления `IsSystem`-роли.** Переноса на дефолтную роль НЕ делаем.

Обоснование: удаление роли, которой активно пользуются, — деструктивный сюрприз. Молчаливый
перенос десятка сотрудников на `Regular` (публичная роль без доступа) — незаметная массовая потеря
доступа. Требование «сначала переназначь людей вручную, потом удаляй» предсказуемо и заставляет
админа осознанно принять решение по каждому. FK `UserRole ← User` уже `OnDelete(Restrict)` — БД и
так не даст удалить; сервис отдаёт осмысленную 409 вместо сырой ошибки БД.

### 0.5. SuperAdmin и жёстко зашитый Admin — вне матрицы (решение 10 чек-листа — не трогаем)

`User.IsSuperAdmin` и `is_super_admin`-claim остаются как есть. Проверка SuperAdmin
(`UserRoleUpdateService.GuardRoleChange`, читает `IsSuperAdmin` из БД) — не часть матрицы прав, не
трогаем. Единственная правка `GuardRoleChange` — читать системность роли через `Type == RoleType.Admin`
(теперь `Type` nullable), а не через что-либо, зависящее от `Name`.

Экраны **управления самой системой прав и мета-настройками** (`api/Roles`, `api/Screens`,
`api/EmailTemplate` — уведомления) — **не** в матрице из 11 ключей. Они остаются на жёстко зашитом
`[Authorize(Roles = ApiRoles.Admin)]` (deny-by-default = только системный Admin, решение 5). Это
не противоречит «заменить весь `[Authorize(Roles=…)]`»: заменяются гейты **фич-экранов** из
инвентаризации; мета-экраны админ-управления гейтятся Admin-ролью так же жёстко, как SuperAdmin.

### 0.6. Реестр экранов — строковые ключи, не enum

**Решение: единый реестр — статический класс `AdminScreens` со строковыми `const`-ключами и
списком `ScreenDefinition`, а не C#-enum.**

Обоснование:
- Ключи содержат точку-неймспейс (`catalog.places`) — членом enum это не выразить без маппинга
  «enum→строка», что и есть лишний слой.
- Хранение строкой в `RolePermission.ScreenKey` (nvarchar) делает добавление/удаление/переименование
  экрана **чисто аддитивной** правкой одного списка в коде — без изменения типа-int, без миграции
  схемы (см. §5 «Как добавить экран»).
- Строковый ключ 1:1 совпадает с ключом фронта — контракт (§4) читается без трансляции.
- Deny-by-default соблюдается: ключа нет в реестре → эндпоинт с `[RequiresPermission("этот-ключ")]`
  ни у кого (кроме Admin) не пройдёт, а для фронта его просто не существует.

---

## §1. Модель данных (Этап 1)

### 1.1. `UserRole` — эволюция (Этап 1.1, 1.6)

Файл `ATTours.Common/Entities/UserRole.cs` — **изменить**:
```
[EntityTypeConfiguration(typeof(UserRoleConfiguration))]
public class UserRole : EntityBase
{
    public string Name { get; set; }              // было Description; отображаемое имя роли
    public RoleType? Type { get; set; }           // было non-nullable; null у кастомных ролей
    public bool IsSystem { get; set; }            // новое; системные 4 роли = true
    public HashSet<User> Users { get; set; } = [];
    public ICollection<RolePermission> Permissions { get; set; } = []; // новое, обратная навигация
}
```

Файл `ATTours.Common/Infrastructure/EntityConfiguration/UserRoleConfiguration.cs` — **изменить**:
- `Property(x => x.Name).IsRequired().HasMaxLength(256)` (было `Description`).
- `Property(x => x.Type)` — **снять `IsRequired()`** (nullable).
- `Property(x => x.IsSystem).IsRequired()`.
- `HasIndex(x => x.Name).IsUnique()` — имя роли уникально (для валидации дубля при create/rename).
- `HasMany(x => x.Permissions).WithOne(x => x.Role).HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade)`
  — удаление роли уносит её строки прав (удаление роли и так запрещено при наличии юзеров, §0.4,
  но каскад корректен для допустимого случая «роль без юзеров»).
- Существующий `HasMany(x => x.Users)…OnDelete(Restrict)` — **оставить** (защита §0.4).
- `HasData` — **обновить** 4 системные строки под новую форму (см. 1.5).

### 1.2. Реестр экранов + enum действий (Этап 1.2)

Файл `ATTours.Common/Enums/PermissionAction.cs` — **создать**:
```
public enum PermissionAction
{
    View = 1,
    Create = 2,
    Update = 3,
    Delete = 4
}
```

Файл `ATTours.Common/Authorization/AdminScreens.cs` — **создать**. Единственное место, где
перечислены все 11 ключей; читают и `[RequiresPermission]`-handler, и резолвер, и `GET api/Screens`,
и сид миграции.
```
public sealed record ScreenDefinition(
    string Key,
    string DisplayName,               // человекочитаемое имя (RU) для матрицы на фронте
    IReadOnlyList<PermissionAction> Actions);  // какие из 4 флагов применимы к экрану

public static class AdminScreens
{
    // Ключи — единственный источник строк. Использовать эти const в атрибутах контроллеров.
    public const string Dashboard              = "dashboard";
    public const string Products               = "products";
    public const string Calendar               = "calendar";
    public const string Orders                 = "orders";
    public const string CatalogPlaces          = "catalog.places";
    public const string CatalogExpenseTemplates= "catalog.expense-templates";
    public const string CatalogNoteTemplates   = "catalog.note-templates";
    public const string CatalogRegions         = "catalog.regions";
    public const string CatalogTags            = "catalog.tags";
    public const string Users                  = "users";
    public const string Settings               = "settings";

    // Порядок = порядок строк в матрице на фронте.
    public static readonly IReadOnlyList<ScreenDefinition> All = [ … ];

    public static bool IsKnown(string key);                 // для валидации входящих payload
    public static ScreenDefinition? Find(string key);
}
```
Набор действий на экран (из инвентаризации, чек-лист «ИТОГОВЫЙ СПИСОК КЛЮЧЕЙ»):

| Ключ | DisplayName (RU) | Применимые действия |
| --- | --- | --- |
| `dashboard` | Дашборд | View |
| `products` | Туры и экскурсии | View, Create, Update, Delete |
| `calendar` | Календарь и блокировки | View, Create, Delete |
| `orders` | Заказы | View, Create, Update, Delete |
| `catalog.places` | Каталог: точки | View, Create, Update, Delete |
| `catalog.expense-templates` | Каталог: доп. расходы | View, Create, Update, Delete |
| `catalog.note-templates` | Каталог: заметки | View, Create, Update, Delete |
| `catalog.regions` | Каталог: регионы | View, Update |
| `catalog.tags` | Каталог: теги | View, Create, Update, Delete |
| `users` | Пользователи | View, Update, Delete |
| `settings` | Настройки сайта | View, Update |

> `View` присутствует у каждого экрана и является **воротами доступа**: `CanView = false` →
> экран недоступен целиком (решение 3 чек-листа: «CanView=false → None»). `Create/Update/Delete`
> независимы между собой, но каждое дополнительно требует `CanView = true` (см. семантику
> резолва §2.3). У `dashboard` доп. действий нет — только видимость.

### 1.3. `RolePermission` (Этап 1.3)

Файл `ATTours.Common/Entities/RolePermission.cs` — **создать**. Одна строка на (роль, экран).
```
[EntityTypeConfiguration(typeof(RolePermissionConfiguration))]
public class RolePermission : EntityBase
{
    public int RoleId { get; set; }
    public UserRole Role { get; set; }
    public string ScreenKey { get; set; }   // одно из AdminScreens.*
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanUpdate { get; set; }
    public bool CanDelete { get; set; }
}
```
Файл `ATTours.Common/Infrastructure/EntityConfiguration/RolePermissionConfiguration.cs` —
**создать**:
- `ToTable(nameof(RolePermission))`.
- `Property(x => x.ScreenKey).IsRequired().HasMaxLength(100)`.
- `HasIndex(x => new { x.RoleId, x.ScreenKey }).IsUnique()` — не больше одной строки на (роль, экран).
- FK на `UserRole` — уже задан со стороны `UserRoleConfiguration` (Cascade).
- **Без `HasData`** — таблица наполняется рантайм-CRUD'ом (создание/правка ролей). Сид системных
  ролей делается миграцией через `InsertData` (1.5), а не `HasData`, чтобы seed не конфликтовал с
  последующими правками матрицы из UI.

### 1.4. `UserPermissionOverride` (Этап 1.4)

Файл `ATTours.Common/Entities/UserPermissionOverride.cs` — **создать**. Одна строка на
(пользователь, экран); каждый флаг nullable — `null` = наследовать от роли.
```
[EntityTypeConfiguration(typeof(UserPermissionOverrideConfiguration))]
public class UserPermissionOverride : EntityBase
{
    public int UserId { get; set; }
    public User User { get; set; }
    public string ScreenKey { get; set; }   // одно из AdminScreens.*
    public bool? CanView { get; set; }
    public bool? CanCreate { get; set; }
    public bool? CanUpdate { get; set; }
    public bool? CanDelete { get; set; }
}
```
Файл `ATTours.Common/Infrastructure/EntityConfiguration/UserPermissionOverrideConfiguration.cs` —
**создать**:
- `ToTable(nameof(UserPermissionOverride))`.
- `Property(x => x.ScreenKey).IsRequired().HasMaxLength(100)`.
- `HasIndex(x => new { x.UserId, x.ScreenKey }).IsUnique()`.
- FK на `User`: `HasOne(x => x.User).WithMany(x => x.PermissionOverrides).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade)`
  — удаление пользователя (physical; soft-delete не удаляет строки, это ок) уносит его override.

Файл `ATTours.Common/Entities/User.cs` — **изменить**: добавить обратную навигацию
```
public ICollection<UserPermissionOverride> PermissionOverrides { get; set; } = [];
```

### 1.5. Сид системных ролей и их матрицы (Этап 1.5) — эквивалентность текущему поведению

Инвентаризация текущего гейтинга (grep по контроллерам, факт на 2026-08-22):

| Контроллер / эндпоинт | Сейчас | Экран | Действие |
| --- | --- | --- | --- |
| Tour GetAll/GetArchived/InitTour/InitUpdate | TourManagerOrAdmin | products | View |
| Tour CreateTour | TourManagerOrAdmin | products | Create |
| Tour UpdateTour/SetActive/SetArchived/SetFeatured/ReorderFeatured | TM(+Admin для featured) | products | Update (§0.3) |
| Tour DeleteTour | Admin | products | Delete |
| Availability GetCalendar/GetRules | Admin | calendar | View |
| Availability CreateRules | Admin | calendar | Create |
| Availability DeleteRule/DeleteRules | Admin | calendar | Delete |
| Order GetById/GetAll/{id}/Events | Admin | orders | View |
| Order AddLine/AddPayment | Admin | orders | Create |
| Order SetStatus/UpdateLine/AssignEmployee/UnassignEmployee/SendToClient | Admin | orders | Update |
| Order RemoveLine/Delete | Admin | orders | Delete |
| Place GetAll / Create / Update / Delete | TM(View)/Admin(CUD) | catalog.places | View/Create/Update/Delete |
| ExpenseTemplate GetAll / CUD | TM(View)/Admin(CUD) | catalog.expense-templates | View/Create/Update/Delete |
| TourNoteTemplate GetAll / CUD | TM(View)/Admin(CUD) | catalog.note-templates | View/Create/Update/Delete |
| Region GetAll / UpdateBlurb | TM(View)/Admin(Update) | catalog.regions | View / Update |
| Tag GetAll / CUD | TM(View)/Admin(CUD) | catalog.tags | View/Create/Update/Delete |
| Users GetAll/{id}/{id}/LoginHistory | Admin | users | View |
| Users ChangeRole/SetJobRole/ForcePasswordReset | Admin | users | Update |
| Users Delete | Admin | users | Delete |
| SiteSettings GetAll / Update | Admin | settings | View / Update |

> `dashboard` не имеет backend-эндпоинта (агрегатный экран фронта); ключ существует для
> guard'а роутера и будущих stat-эндпоинтов. В сиде дают View тем, кто вообще заходит в
> админку (TourManager, Admin).

**НЕ гейтятся матрицей (остаются как есть, вне 11 ключей):**
- `Order Create/Update/GetMine` — `[Authorize]` (клиентские брони, любой аутентифицированный;
  владелец-проверка внутри). Не трогать.
- `Order GetAssignedToMe` — `[Authorize(Roles = ApiRoles.Employee)]` (Employee вне скоупа,
  решение 9). Не трогать.
- Все `#region ClientEndpoints` в Tour/Place/ExpenseTemplate/TourNoteTemplate/Region/Tag/
  Availability/SiteSettings — анонимные, публичный сайт. Не трогать.
- `Upload/Image` — кросс-скрин утилита, см. §2.5 (`RequiresAnyPermission`).

Итоговая матрица сида (`—` = строки нет, т.е. deny):

| Экран | Regular | Employee | TourManager | Admin |
| --- | --- | --- | --- | --- |
| dashboard | — | — | V | V |
| products | — | — | V C U | V C U D |
| calendar | — | — | — | V C D |
| orders | — | — | — | V C U D |
| catalog.places | — | — | V | V C U D |
| catalog.expense-templates | — | — | V | V C U D |
| catalog.note-templates | — | — | V | V C U D |
| catalog.regions | — | — | V | V U |
| catalog.tags | — | — | V | V C U D |
| users | — | — | — | V U D |
| settings | — | — | — | V U |

Regular и Employee — без строк (в админку не ходят; Employee ходит только в свой read-only
эндпоинт через жёсткий `[Authorize(Roles=Employee)]`). Admin можно и не сидить (резолвер даёт
Admin всё безусловно, §2.3), но строки **создаём для отображения** запертой матрицы в UI.

Сид-миграция (см. 1.6) делает `InsertData` в `RolePermission` для строк TourManager (Id 2) и
Admin (Id 3) по таблице выше. Для стабильных Id строк прав — задать явные Id в `InsertData`
(например, начиная с 1) либо не задавать (identity); достаточно детерминированного набора
(RoleId, ScreenKey, флаги), Id роли значения для контракта не имеет.

### 1.6. Миграции + DbSet

Файл `ATTours.DataLayer/ATToursContext.cs` — **изменить**: добавить
```
public DbSet<RolePermission> RolePermissions { get; set; }
public DbSet<UserPermissionOverride> UserPermissionOverrides { get; set; }
```

Одна миграция `AddFlexibleRolesAndPermissions` — **создать**:
1. `RenameColumn` `UserRole.Description` → `Name`.
2. `AlterColumn` `UserRole.Type` → nullable.
3. `AddColumn` `UserRole.IsSystem` (bit, default `0`).
4. `CreateTable` `RolePermission`, `UserPermissionOverride` (+ уникальные индексы).
5. `UpdateData` по 4 системным ролям: `IsSystem = 1` (Type/Name у них уже есть из прошлых сидов).
   Обновление `HasData` в `UserRoleConfiguration` даст это автоматически в snapshot — проверить,
   что сгенерированная миграция содержит `UpdateData`, а не пыталась вставлять заново.
6. `InsertData` в `RolePermission` — матрица сида (1.5) для TourManager и Admin.

Down: обратно (drop таблиц, drop `IsSystem`, `Type` → non-nullable с дефолтом, rename назад).
Проект применяет миграции на старте API (`MigrateDatabase` в `Startup.ConfigureFactory`) — ручных
шагов нет. Data-миграция для `User` не нужна (RoleId у всех уже валиден).

---

## §2. Авторизация (Этап 2)

### 2.1. Резолвер прав — `PermissionResolutionService` (Service)

Файл `ATTours.Service/Services/Authorization/PermissionResolutionService.cs` — **создать**.
Единственное место резолва «роль + override → итоговый набор по экранам». Образец обвязки с
контекстом — `UserRoleUpdateService` (свой `Context` по строке из `CommonSettings`).

```
public class PermissionResolutionService : RepositoryCoreBase<UserRole, ATToursContextFactory>
{
    public PermissionResolutionService(CancellationToken ct = default)
        : base(CommonSettings.Instance.ATToursConnectionString) { … }

    // Резолв для одного пользователя. userRoleType — из уже загруженного user.Role.Type,
    // чтобы отработать shortcut Admin без лишнего запроса.
    public Task<ResolvedPermissionSet> ResolveAsync(int userId, int roleId, RoleType? roleType);
}
```
Файл `ATTours.Common/DTO/Authorization/ResolvedPermissionSet.cs` — **создать** (общий тип
результата резолва; лежит в Common, т.к. его строит Service и потребляют ClientAPI и DTO):
```
public sealed class ResolvedScreenPermission
{
    public string ScreenKey { get; set; }
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanUpdate { get; set; }
    public bool CanDelete { get; set; }
}

public sealed class ResolvedPermissionSet
{
    public bool IsAdmin { get; set; }                        // системный Admin (Type == Admin)
    public IReadOnlyList<ResolvedScreenPermission> Screens { get; set; } = [];
}
```

### 2.2. Алгоритм резолва (в `ResolveAsync`)

Итерация по `AdminScreens.All` (реестр — источник истины, а не таблица БД):
1. **Admin-shortcut:** если `roleType == RoleType.Admin` → у каждого экрана все применимые флаги
   `true`. Возврат с `IsAdmin = true`. (Так новый экран без строк в БД всё равно виден Admin —
   deny-by-default решение 5.)
2. Иначе загрузить `RolePermission` роли (`RoleId == roleId`) и `UserPermissionOverride`
   пользователя (`UserId == userId`), по одному запросу каждый, в словари по `ScreenKey`.
3. Для каждого `ScreenDefinition`:
   - Базовые флаги = строка роли по ключу, либо все `false`, если строки нет.
   - Наложить override пофлагово: если соответствующий `bool?` не `null` — он перекрывает базу
     (и расширяет, и урезает). `null` — берётся значение роли.
   - Флаги действий, **не применимые** к экрану (`ScreenDefinition.Actions` их не содержит),
     форсить в `false` (например, `catalog.regions` никогда не имеет Create/Delete).
   - `IsAdmin = false`.

Резолвер **не решает** «пускать/не пускать» на конкретный эндпоинт — он только строит набор.
Enforcement — в handler'е (§2.4) и в семантике §2.3.

### 2.3. Семантика «действие разрешено»

`allowed(screen, action)` = `screen.CanView` **AND** (`action == View` ? `true` : `screen.<action-flag>`).

То есть: `CanView == false` → закрыто всё на экране (ворота). `Create/Update/Delete` независимы
между собой, но каждое требует ещё и `CanView`. Это ровно решение 3 чек-листа. Эта проверка —
одна функция-помощник, используется и handler'ом, и при формировании baked-claim (§2.6).

### 2.4. Атрибут `[RequiresPermission]` + чтение прав из токена (Этап 2.1)

Файл `ATTours.ClientAPI/Authorization/RequiresPermissionAttribute.cs` — **создать**. Реализация —
`Attribute`, реализующий `IAuthorizationFilter` (синхронный, без DI, без БД — только парсинг
claim'а). Порядок: сперва отрабатывает `[Authorize]`-конвейер (аутентификация JWT), затем фильтр.
```
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public sealed class RequiresPermissionAttribute : Attribute, IAuthorizationFilter
{
    public RequiresPermissionAttribute(string screenKey, PermissionAction action);
    public void OnAuthorization(AuthorizationFilterContext context);
    // Логика: не аутентифицирован → 401 (Challenge). is_admin-claim == "true" → allow.
    //         Иначе распарсить claim "perms" (§2.6), проверить allowed(screen, action) → иначе 403.
}
```
Требует `[Authorize]` на контроллере/методе для самой аутентификации (или добавить проверку
`context.HttpContext.User.Identity?.IsAuthenticated`). Ставить `[Authorize]` на контроллере +
`[RequiresPermission(...)]` на методах.

Файл `ATTours.ClientAPI/Authorization/RequiresAnyPermissionAttribute.cs` — **создать** (для
Upload, §2.5). То же, но принимает несколько пар `(screenKey, action)` и пускает, если разрешена
**любая**.
```
public sealed class RequiresAnyPermissionAttribute : Attribute, IAuthorizationFilter
{
    public RequiresAnyPermissionAttribute(params string[] screenActionPairs); // "products:Update" и т.п.
}
```
(Форму параметров backend-developer вправе выбрать удобную — важно поведение «OR по списку».)

Файл `ATTours.ClientAPI/Extensions/ClaimsPrincipalExtensions.cs` — **изменить**: добавить
хелпер парсинга baked-прав из claim'а `perms` в структуру для проверки `allowed(screen, action)`.

### 2.5. Пройтись по контроллерам (Этап 2.2) — точечная разметка

Заменить на каждом методе `[Authorize(Roles = ApiRoles.X)]` → `[RequiresPermission(AdminScreens.Y, PermissionAction.Z)]`,
по таблице инвентаризации §1.5. На каждом контроллере оставить/добавить `[Authorize]`
(аутентификация). Конкретно:

- **TourController** — методы по §1.5/§0.3. `#region ClientEndpoints` не трогать.
- **AvailabilityController** — GetCalendar/GetRules→`calendar.View`; CreateRules→`calendar.Create`;
  DeleteRule/DeleteRules→`calendar.Delete`. `GetClosedDates` не трогать.
- **OrderController** — только админские методы по §1.5 (View/Create/Update/Delete на `orders`).
  `Create`/`Update`/`GetMine` (`[Authorize]`) и `GetAssignedToMe` (`[Authorize(Roles=Employee)]`) —
  **не трогать**.
- **PlaceController / ExpenseTemplateController / TourNoteTemplateController / TagController** —
  GetAll→`.View`, Create→`.Create`, Update→`.Update`, Delete→`.Delete` (свой ключ каталога).
  `GetForClient` не трогать.
- **RegionController** — GetAll→`catalog.regions.View`; UpdateBlurb→`catalog.regions.Update`.
  `GetRegionsClient` не трогать.
- **UsersController** — сейчас `[Authorize(Roles="Admin")]` на **контроллере**. Заменить на
  `[Authorize]` на контроллере + пометодно: GetUsers/GetUserById/GetLoginHistory→`users.View`;
  ChangeRole/SetJobRole/ForcePasswordReset→`users.Update`; DeleteUser→`users.Delete`.
  (SuperAdmin-guard внутри `ChangeRole` остаётся — §0.5.)
- **SiteSettingsController** — GetAll→`settings.View`; Update→`settings.Update`. `GetPublic` не трогать.
- **UploadController** — `Upload/Image`: заменить `[Authorize(Roles=TourManagerOrAdmin)]` на
  `[RequiresAnyPermission]` c набором `products.Create`, `products.Update`, `catalog.places.Create`,
  `catalog.places.Update`, `settings.Update` (кто может редактировать контент с картинками, тот
  может и загрузить). Сохраняет текущий доступ (TourManager имеет `products.Update`).

**НЕ конвертируются (мета-экраны, остаются `[Authorize(Roles = ApiRoles.Admin)]`):**
`EmailTemplateController` (уведомления), а также новые `RolesController`/`ScreensController`
(§3). Это deny-by-default админ-мета (§0.5).

### 2.6. Печём права в токен (Этап 2, интеграция с auth)

Файл `ATTours.Service/Security/JwtTokenService.cs` — **изменить**: сигнатура
`CreateAccessToken(User user, ResolvedPermissionSet permissions)`. Добавить в claims:
- `is_admin` = `"true"` — **только** если `permissions.IsAdmin` (как уже сделано для `is_super_admin`:
  claim присутствует только когда true).
- `perms` — **компактная строка**: для каждого экрана, где `allowed(screen, View)` (т.е.
  `CanView == true`), — `"ключ:БУКВЫ"`, где буквы = `V` + любые из `C`/`U`/`D`, что разрешены;
  экраны с `CanView == false` **опускаются целиком**. Записи через `;`.
  Пример: `dashboard:V;products:VCU;catalog.tags:V`.
  Обоснование формата: компактно (токен едет в каждом заголовке), тривиально парсится и
  backend-handler'ом, и (при желании) фронтом; опущенные экраны = «нет доступа» = ровно семантика
  §2.3. `ClaimTypes.Role` (`user.Role.Type?.ToString()`, только для системных ролей; у кастомной
  роли Type=null → role-claim не добавляется) — **оставить**: его всё ещё читают жёсткие
  `[Authorize(Roles=Admin/Employee)]` на мета-экранах и Employee-эндпоинте.

Файл `ATTours.Service/Services/AuthServices/AuthService.cs` — **изменить**:
- В `LoginAsync`, `DevLoginAsync`, `RefreshAsync` перед `CreateAccessToken`: резолвить права
  (`new PermissionResolutionService(ct).ResolveAsync(user.Id, user.RoleId, user.Role.Type)`) и
  передавать в `CreateAccessToken(user, resolved)`. `RefreshAsync` уже грузит `user.Role` (Include),
  так что перерезолв на каждой ротации — это и есть механика авто-применения (§0.2).
- `IJwtTokenService.CreateAccessToken` — обновить интерфейс под новую сигнатуру.

### 2.7. `ApiRoles.cs` (Этап 2.3)

Файл `ATTours.ClientAPI/Authorization/ApiRoles.cs` — **изменить**: удалить `TourManagerOrAdmin`
(больше не используется — фич-экраны на матрице). **Оставить** `Admin` (мета-экраны §0.5) и
`Employee` (`GetAssignedToMe`, решение 9). `RoleType.TourManager`/`Regular` в enum остаются —
это системные роли данных, просто больше не фигурируют в `[Authorize(Roles=…)]`.

### 2.8. Сборка (Этап 2.4)

После правок — `dotnet build` решения без ошибок. Отдельно проверить компиляцию всех мест вызова
`CreateAccessToken` (сигнатура изменилась) и что нигде не осталось `ApiRoles.TourManagerOrAdmin`.

---

## §3. API управления ролями и правами (Этап 3)

### 3.1. Сервисы (Service)

Все — по образцу `UserRole*`/`Tag*`-сервисов, свой `Context` по строке из `CommonSettings`:
- `ATTours.Service/Services/InfoServices/RoleInfo.cs` — **создать**: `GetAllAsync()` (роли +
  `Include(Permissions)`), `GetByIdAsync(id)`.
- `ATTours.Service/Services/CreateServices/RoleCreationService.cs` — **создать**: создать роль
  (Name уникален, `IsSystem=false`, `Type=null`) + строки `RolePermission` из переданной матрицы.
- `ATTours.Service/Services/UpdateServices/RoleUpdateService.cs` — **создать**: переименование +
  перезапись матрицы прав. **Запрет** менять `IsSystem`-роль? — переименование системной роли
  запрещаем (её `Name` — часть контракта UI, а `Type` неизменен); **матрицу системной роли
  править запрещаем тоже** (эквивалентность поведения — ответственность системных ролей
  фиксирована). При попытке → `RoleIsSystem` (403). Кастомные роли — свободно.
- `ATTours.Service/Services/DeleteServices/RoleDeletionService.cs` — **создать**: `IsSystem` →
  `RoleIsSystem` (403); есть не-удалённые `User` с этим `RoleId` → `RoleInUse` (409); иначе
  удалить (каскад уносит `RolePermission`).
- `ATTours.Service/Services/UpdateServices/UserPermissionOverrideUpdateService.cs` — **создать**:
  upsert/снятие override пользователя. Пустой набор флагов (`null,null,null,null`) по ключу →
  удалить строку override (чистое «наследовать от роли»). Валидировать `ScreenKey` через
  `AdminScreens.IsKnown` → иначе `UnknownScreenKey` (400).
- Валидация матрицы (и в create, и в update): каждый `ScreenKey` из `AdminScreens.IsKnown`; флаги
  действий, не входящих в `ScreenDefinition.Actions`, форсить в `false` (нельзя выдать Create у
  `catalog.regions`). Имя роли не пустое и уникальное → иначе `RoleNameInvalid` (400).

### 3.2. DTO (Common)

Файл `ATTours.Common/DTO/Authorization/RoleInfoModel.cs` — **создать**:
```
public class RoleInfoModel
{
    public int Id { get; set; }
    public string Name { get; set; }
    public RoleType? Type { get; set; }        // null у кастомных
    public bool IsSystem { get; set; }
    public int UserCount { get; set; }         // сколько юзеров на роли (для UI удаления)
    public List<ScreenPermissionModel> Permissions { get; set; } = []; // по всем экранам реестра
}

public class ScreenPermissionModel
{
    public string ScreenKey { get; set; }
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanUpdate { get; set; }
    public bool CanDelete { get; set; }
}
```
`GET api/Roles` возвращает матрицу **по всем экранам реестра** (недостающие строки БД → все
`false`), а не только по имеющимся строкам — фронт строит полную таблицу. Заполнение отсутствующих
экранов — в `RoleInfo`/маппинге через `AdminScreens.All`.

Файл `ATTours.Common/DTO/Authorization/RoleSaveModel.cs` — **создать** (для POST/PUT):
```
public class RoleSaveModel
{
    public int? Id { get; set; }               // null = create
    public string Name { get; set; }
    public List<ScreenPermissionModel> Permissions { get; set; } = [];
}
```

Файл `ATTours.Common/DTO/Authorization/ScreenDefinitionModel.cs` — **создать** (для `GET api/Screens`):
```
public class ScreenDefinitionModel
{
    public string Key { get; set; }
    public string DisplayName { get; set; }
    public List<PermissionAction> Actions { get; set; } = [];  // применимые флаги
}
```

Файл `ATTours.Common/DTO/Authorization/UserPermissionOverrideSaveModel.cs` — **создать**:
```
public class UserPermissionOverrideSaveModel
{
    public int UserId { get; set; }
    public List<ScreenOverrideModel> Overrides { get; set; } = [];
}
public class ScreenOverrideModel
{
    public string ScreenKey { get; set; }
    public bool? CanView { get; set; }
    public bool? CanCreate { get; set; }
    public bool? CanUpdate { get; set; }
    public bool? CanDelete { get; set; }
}
```

Файл `ATTours.Common/DTO/Authorization/MyPermissionsModel.cs` — **создать** (см. §4 — контракт фронта).

### 3.3. Контроллеры (ClientAPI)

Файл `ATTours.ClientAPI/Controllers/RolesController.cs` — **создать**. `[ApiController]`,
`[Route("api/[controller]")]`, `[Authorize(Roles = ApiRoles.Admin)]` на контроллере (мета-экран,
§0.5). Конструктор `(IMapper mapper)`, сервисы через `new` + `using` (стиль `TagController`).

| Метод | Маршрут | Тело | Возврат | Сервис |
| --- | --- | --- | --- | --- |
| GET | `api/Roles` | — | `List<RoleInfoModel>` | `RoleInfo.GetAllAsync` (Этап 3.1) |
| POST | `api/Roles` | `RoleSaveModel` | `RoleInfoModel` | `RoleCreationService` (3.2) |
| PUT | `api/Roles/{id}` | `RoleSaveModel` | `RoleInfoModel` | `RoleUpdateService` (3.3) |
| DELETE | `api/Roles/{id}` | — | 204 | `RoleDeletionService` (3.4) |

Файл `ATTours.ClientAPI/Controllers/ScreensController.cs` — **создать**. `[Authorize(Roles=ApiRoles.Admin)]`.
| GET | `api/Screens` | — | `List<ScreenDefinitionModel>` | из `AdminScreens.All` (маппинг, без БД) |
(Этап 3.5 — реестр экранов для матрицы на фронте.)

Файл `ATTours.ClientAPI/Controllers/UsersController.cs` — **изменить** (Этап 3.6): добавить
```
[HttpGet]  [Route("{id:int}/PermissionOverrides")]  // users.View
public async Task<List<ScreenOverrideModel>> GetPermissionOverridesAsync(int id, CancellationToken ct)

[HttpPut]  [Route("{id:int}/PermissionOverrides")]  // users.Update
public async Task PutPermissionOverridesAsync(int id, [FromBody] UserPermissionOverrideSaveModel model, CancellationToken ct)
```
Гейтить `[RequiresPermission(AdminScreens.Users, View/Update)]` (управление override — часть
экрана «Пользователи»). `id` из маршрута = целевой пользователь.

`GET api/Auth/MyPermissions` (Этап 3.7) — **добавить в `AuthController`** (там же, где живёт
auth-вертикаль на DI). `[Authorize]`. Резолвит права текущего пользователя из БД (свежие, не из
токена — фронт может дёрнуть после смены и увидеть актуальное без ожидания рефреша) и отдаёт
`MyPermissionsModel` (§4).
```
[HttpGet] [Route("MyPermissions")] [Authorize]
public async Task<MyPermissionsModel> MyPermissionsAsync(CancellationToken ct)
```
Реализация: `AuthService` — **добавить** метод `Task<MyPermissionsModel> GetMyPermissionsAsync(int userId, ct)`
(грузит user+Role, зовёт `PermissionResolutionService`, мапит в `MyPermissionsModel`, доклеивает
`isSuperAdmin` из `user.IsSuperAdmin`). Контроллер: `authService.GetMyPermissionsAsync(User.GetUserId(), ct)`.

### 3.4. AutoMapper + DI

Файл `ATTours.ClientAPI/Mapper/MappingProfile.cs` — **изменить**:
- `UserRole → RoleInfoModel` (+ `AfterMap`: развернуть `Permissions` по всем `AdminScreens.All`,
  проставить `UserCount`).
- `ResolvedPermissionSet → MyPermissionsModel`.
- `RolePermission → ScreenPermissionModel`, `UserPermissionOverride → ScreenOverrideModel`.
- **Важно (регресс):** `UserInfoModel.Role`/`UserDetailInfoModel.Role` сейчас маппятся из
  `src.Role.Type` (non-nullable `RoleType`). После nullable `Type` у кастомных ролей это упадёт/
  даст 0. **Изменить** `UserInfoModel`/`UserDetailInfoModel`: `Role` → `RoleType?`; добавить
  `RoleName` (string, из `Role.Name`) — фронту-админке нужно показывать имя кастомной роли, а не
  только enum. Маппинг: `Role` ← `src.Role.Type`, `RoleName` ← `src.Role.Name`.

Файлы `ATTours.Common/DTO/Auth/UserInfoModel.cs`, `UserDetailInfoModel.cs` — **изменить**:
`public RoleType? Role`, `public string RoleName`.

DI: новые CRUD-сервисы ролей создаются через `new` + `using` (не через контейнер) — как весь не-auth
код. `PermissionResolutionService` — тоже `new` (его зовёт `AuthService`, который уже на DI, но сам
резолвер владеет своим контекстом и создаётся `new` внутри метода, как `AuthService` создаёт
`UserRegistrationValidationService`). **Ничего в `DependencyInjectionConfiguration` добавлять не нужно.**

### 3.5. Новые коды ошибок

Файл `ATTours.Helper/Enums/GlobalErrorCode.cs` — **изменить**, блок `#region EntityErrors`
(следующие свободные после `EmailTemplateInvalid = 2030`):
```
[Description("Role is a system role and cannot be modified or deleted.")]
RoleIsSystem = 2031,
[Description("Role has assigned users and cannot be deleted.")]
RoleInUse = 2032,
[Description("Unknown admin screen key.")]
UnknownScreenKey = 2033,
[Description("Role name is empty or already taken.")]
RoleNameInvalid = 2034,
```
`RoleNotFound = 2206` (AuthErrors) — **переиспользовать** для «роль по id не найдена».

---

## §4. Контракт для фронтенда (Этап 0.2 — САМОЕ ВАЖНОЕ для передачи)

Фронтенд-архитектор строит гарды роутера и enable/disable кнопок **на этом контракте**. Он
заменяет текущий `shared/auth/permissions.ts` (isStaff/isAdmin/canManageX).

### 4.1. `GET api/Auth/MyPermissions` → `MyPermissionsModel`

Отдаёт РЕЗОЛВЛЕННЫЙ (роль + override) набор прав текущего пользователя **по всем 11 экранам
реестра** — включая экраны с `canView=false` (фронт сам решает прятать):
```
public class MyPermissionsModel
{
    public bool IsAdmin { get; set; }        // системный Admin → полный доступ; фронт может шорткатить
    public bool IsSuperAdmin { get; set; }   // существующий флаг (canManageAdmins) — НЕ часть матрицы
    public List<MyScreenPermissionModel> Screens { get; set; } = [];
}

public class MyScreenPermissionModel
{
    public string ScreenKey { get; set; }    // "orders", "catalog.places", …
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanUpdate { get; set; }
    public bool CanDelete { get; set; }
}
```
Правила использования на фронте:
- Показывать раздел/маршрут ⟺ `canView == true` (иначе экран не существует для пользователя).
- Кнопка «Создать» активна ⟺ `canView && canCreate`; «Редактировать/сохранить» ⟺ `canView && canUpdate`;
  «Удалить» ⟺ `canView && canDelete`.
- `isAdmin == true` → все экраны/действия доступны (можно не проверять пофлагово).
- `isSuperAdmin` — только для управления админ-аккаунтами (существующая логика canManageAdmins),
  **не** смешивать с матрицей.
- **Когда вызывать:** после логина (либо параллельно с получением профиля `api/Account/Me`), и
  повторно после действий, меняющих права (напр. self — редко). Значения совпадают с тем, что
  «запечено» в JWT (`perms`/`is_admin`), но эндпоинт всегда отдаёт свежее из БД — фронт может не
  ждать ротацию токена, чтобы отрисовать актуальные гарды. Enforcement на бэке при этом остаётся
  по токену (§0.2): расширенный доступ реально появится после ротации access-токена (≤15 мин),
  UI-отрисовка — сразу.

### 4.2. `GET api/Screens` → `List<ScreenDefinitionModel>`

Реестр всех экранов с человекочитаемым именем и применимыми действиями — фронт строит по нему
**редактор матрицы роли** (строки = экраны, колонки = только применимые из V/C/U/D):
```
{ "key": "catalog.regions", "displayName": "Каталог: регионы", "actions": [1, 3] }  // View, Update
```

### 4.3. `GET/POST/PUT/DELETE api/Roles`, `PUT api/Users/{id}/PermissionOverrides`

Формы `RoleInfoModel`/`RoleSaveModel`/`ScreenPermissionModel`/`UserPermissionOverrideSaveModel`
(§3.2) — для экрана управления ролями (Этап 5 фронта) и блока override на карточке пользователя.

---

## §5. Как добавить/изменить экран ПОСЛЕ этой задачи (жёсткое требование 11 чек-листа)

Система спроектирована так, что жизненный цикл экрана — **механическая операция без миграций
схемы и без правок ядра авторизации**. Ядро (резолвер, `[RequiresPermission]`-handler, таблицы
`RolePermission`/`UserPermissionOverride`, печение в токен, `MyPermissions`) знать про конкретные
экраны не обязано — оно итерирует по реестру `AdminScreens.All` и по строковым ключам.

### Добавить НОВЫЙ экран (напр. «Платежи», ключ `payments`)
1. Реестр: добавить `const string Payments = "payments"` и одну запись `ScreenDefinition` в
   `AdminScreens.All` (ключ, RU-имя, применимые действия). **Одна правка одного файла в Common.**
2. Контроллер: на эндпоинты нового `PaymentsController` навесить
   `[RequiresPermission(AdminScreens.Payments, PermissionAction.View/Create/…)]`.
3. Фронт: guard роутера и кнопки читают `MyPermissions.screens["payments"]` (появляется автоматически
   — `GET api/Screens` и `GET api/Auth/MyPermissions` уже итерируют реестр).
4. Доступ по умолчанию: **никто, кроме Admin** (deny-by-default, §2.2 shortcut). Чтобы выдать
   экран кастомной роли — админ ставит галки в матрице через `PUT api/Roles/{id}` (данные, не код).

**Ни миграции, ни изменения таблиц, ни правок резолвера/handler'а/токена.** Строки прав для нового
ключа создаются рантаймом при первом сохранении матрицы; их отсутствие = deny.

> Так же в матрицу можно **промотировать мета-экран**: сегодня `api/EmailTemplate` (уведомления),
> `api/Roles`, `api/Screens` живут на жёстком `[Authorize(Roles=Admin)]` (§0.5). Когда понадобится
> отдать, например, «Уведомления» кастомной роли — это ровно шаги 1–2 выше (завести ключ
> `notifications`, сменить атрибут), без изменения ядра. Именно поэтому мета-экраны сейчас
> оставлены вне матрицы: их промоушен — та же механическая операция, а не переделка системы.

### Переименовать/раздробить/слить экран
- **Переименовать отображение:** поменять `DisplayName` в реестре. Ключ не трогать — строки прав в
  БД привязаны к ключу.
- **Сменить ключ / раздробить:** ввести новый ключ в реестр, перевесить атрибуты на контроллере,
  (опционально) дата-миграцией скопировать строки `RolePermission` со старого ключа на новый.
  Старые строки с исчезнувшим ключом безвредны — резолвер их игнорирует (итерирует по реестру,
  не по БД). Схема не меняется.
- **Удалить экран:** убрать запись из реестра и атрибуты с контроллера. Осиротевшие строки
  `RolePermission`/`UserPermissionOverride` останутся в БД и будут игнорироваться (можно вычистить
  дата-миграцией, но не обязательно).

---

## §6. Сводка «что создать / что изменить»

### ATTours.Common
- **создать** `Enums/PermissionAction.cs`
- **создать** `Authorization/AdminScreens.cs` (реестр + `ScreenDefinition`)
- **создать** `Entities/RolePermission.cs`, `Entities/UserPermissionOverride.cs`
- **создать** `Infrastructure/EntityConfiguration/RolePermissionConfiguration.cs`,
  `UserPermissionOverrideConfiguration.cs`
- **создать** DTO в `DTO/Authorization/`: `ResolvedPermissionSet.cs`, `RoleInfoModel.cs`,
  `RoleSaveModel.cs`, `ScreenDefinitionModel.cs`, `UserPermissionOverrideSaveModel.cs`,
  `MyPermissionsModel.cs`
- **изменить** `Entities/UserRole.cs` (`Name`, `Type?`, `IsSystem`, `Permissions`)
- **изменить** `Entities/User.cs` (`PermissionOverrides`)
- **изменить** `Infrastructure/EntityConfiguration/UserRoleConfiguration.cs` (Name/Type?/IsSystem/
  Name-unique/HasData под новую форму)
- **изменить** `DTO/Auth/UserInfoModel.cs`, `DTO/Auth/UserDetailInfoModel.cs` (`Role → RoleType?`,
  `+ RoleName`)

### ATTours.Helper
- **изменить** `Enums/GlobalErrorCode.cs` (+2031..2034)

### ATTours.DataLayer
- **изменить** `ATToursContext.cs` (+2 DbSet)
- **создать** миграцию `AddFlexibleRolesAndPermissions` (rename Description→Name, Type→nullable,
  +IsSystem, +2 таблицы, UpdateData IsSystem, InsertData матрицы сида)

### ATTours.Service (ATTours.BusinessServices)
- **создать** `Services/Authorization/PermissionResolutionService.cs`
- **создать** `Services/InfoServices/RoleInfo.cs`
- **создать** `Services/CreateServices/RoleCreationService.cs`
- **создать** `Services/UpdateServices/RoleUpdateService.cs`,
  `Services/UpdateServices/UserPermissionOverrideUpdateService.cs`
- **создать** `Services/DeleteServices/RoleDeletionService.cs`
- **изменить** `Security/JwtTokenService.cs` + `Security/IJwtTokenService.cs`
  (`CreateAccessToken(User, ResolvedPermissionSet)`, claims `is_admin`/`perms`)
- **изменить** `Services/AuthServices/AuthService.cs` + `IAuthService.cs`
  (резолв перед выпуском токена в Login/DevLogin/Refresh; `GetMyPermissionsAsync`)
- **изменить** `Services/UpdateServices/UserRoleUpdateService.cs` (guard читает `Type == RoleType.Admin`,
  теперь nullable — сверить)

### ATTours.ClientAPI
- **создать** `Authorization/RequiresPermissionAttribute.cs`, `Authorization/RequiresAnyPermissionAttribute.cs`
- **создать** `Controllers/RolesController.cs`, `Controllers/ScreensController.cs`
- **изменить** `Authorization/ApiRoles.cs` (убрать `TourManagerOrAdmin`)
- **изменить** `Extensions/ClaimsPrincipalExtensions.cs` (парсер `perms`-claim)
- **изменить** контроллеры: Tour, Availability, Order, Place, ExpenseTemplate, TourNoteTemplate,
  Region, Tag, Users, SiteSettings, Upload (замена `[Authorize(Roles=…)]` → `[RequiresPermission]`/
  `[RequiresAnyPermission]` по §2.5; Users + override-эндпоинты по §3.3)
- **изменить** `Controllers/AuthController.cs` (+`MyPermissions`)
- **изменить** `Mapper/MappingProfile.cs` (роли/права/override/MyPermissions; фикс `UserInfoModel.Role`)

### Явно вне скоупа
- **Принудительный немедленный revoke сессий** при смене прав (§0.2) — применяется eventual через
  ротацию токена; жёсткий отзыв — отдельная задача.
- **Роль Employee** и её поведение (`GetAssignedToMe`, `[Authorize(Roles=Employee)]`) — решение 9,
  не трогаем.
- **SuperAdmin / `canManageAdmins`** — решение 10, не трогаем (кроме сверки `Type==Admin` в guard).
- **Промоушен мета-экранов** (`api/Roles`/`api/Screens`/`api/EmailTemplate`) в матрицу — оставлены
  на жёстком Admin; заводить для них 12-й+ ключ в рамках ЭТОЙ задачи не нужно (§0.5, §5).
- **Весь фронтенд** (Этапы 0.2, 5, 6, 7 чек-листа) — зона фронтенд-`architect`; здесь только
  контракт §4.
- **Тесты** (Этап 4) — зона backend-tester.
