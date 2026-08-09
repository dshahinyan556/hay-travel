# User management — статус и решения

Источник правды по User/UserRole/PasswordRecovery. Работа над этой темой начата 2026-08-02.
Сделано в этой сессии: **только схема БД (Entity + EF-конфигурация + миграция), без единой
строчки бизнес-логики/контроллеров.** Ссылка сюда — из `CHANGELOG.md`.

## 2026-08-09/10 — Личный кабинет (/account), email-change UI, SuperAdmin, LoginHistory, гео-IP

Полный чек-лист со всеми согласованными с Давидом решениями — `Hay Travel/profile-account-checklist-2026-08-09.txt` (не пересказывается здесь). Архитектурные решения фронта — `docs/adr/010-account-route-inside-auth-feature.md`, `docs/adr/011-superadmin-flag-from-jwt-claim.md`.

**Бэкенд — новые эндпоинты:**
- Новый `AccountController` (`[Authorize]`, self-service, отдельно от `AuthController` — телефон/профиль это profile-данные, не credential/auth-состояние):
  - `GET api/Account/Me` → `UserInfoModel` — свой профиль, id только из токена (IDOR невозможен по конструкции). Добавлен по ходу реализации фронта: `AuthUser` восстанавливается декодом JWT (ADR-007) и не несёт firstName/lastName/phoneNumber, а `/account` должен их показывать.
  - `PATCH api/Account/Phone {phoneNumber}` → `UserInfoModel` — самостоятельная смена телефона (раньше такого эндпоинта не было вообще, только сам пользователь задавал его при регистрации). Формат НЕ валидируется на бэке, только длина ≤15 символов, без ведущего `+` (международность — зона `libphonenumber-js` на фронте).
- Новый `GeoController` (`[AllowAnonymous]`) — `GET api/Geo/Country` → `{countryCode, countryName, city}`, БЕЗ dialCode (код страны фронт достаёт сам из `countryCode` через `libphonenumber-js`). Источник — **DB-IP City Lite** (`.mmdb`, читается пакетом `MaxMind.GeoIP2` без аккаунта/ключа — MaxMind как сервис НЕ используется, только их OSS-ридер поверх чужого файла; выбран вместо MaxMind GeoLite2 именно потому, что тот требует регистрацию). База **скачивается при старте бэкенда** (`GeoIpDatabaseDownloadService`, `BackgroundService`, качает `dbip-city-lite-{yyyy-MM}.mmdb.gz` с db-ip.com, откатывается на прошлые месяцы при 404), путь — `GeoIpSettings`, файл НЕ коммитится в git. При недоступности сети/файла — graceful degradation, `Lookup` возвращает `null`, ничего не падает.
- `UsersController.GetUserLoginHistory` — `GET api/Users/{id:int}/LoginHistory` → `LoginHistoryModel[]` (top-100), только `[Authorize(Roles="Admin")]`. На публичном `/account` истории входов НЕТ — осознанно информация для администраторов, не для самого пользователя.
- **`UseForwardedHeaders`** добавлен в `Startup.cs` (`XForwardedFor | XForwardedProto`, `KnownNetworks`/`KnownProxies` очищены — единственный публичный вход это Netlify/Azure) — обязателен, иначе `GeoController`/`LoginHistory` за прокси видят IP самого прокси, а не визитёра. Проверено вживую: `X-Forwarded-For: 8.8.8.8` → `US/Mountain View`, цепочка `клиент, прокси` → берётся левый (реальный клиент).

**Email-change UI подключён.** Бэкенд (B8) был готов ещё с 2026-08-06, фронта под него не было. 4-шаговый визард (`RequestEmailChange` → `ConfirmEmailChangeCode` → `RequestNewEmail` → `ConfirmEmailChange`) теперь живёт на `/account`, шаг 4 (переход по ссылке из письма) — отдельный роут `/auth/confirm-email-change` (+ legacy-редирект со старого `/confirm-email-change`, конфиг бэкенда не трогали). Успешная смена email принудительно разлогинивает — иначе старый адрес, зашитый в JWT-claim, висел бы в шапке до конца вкладки.

**Новый роут `/account`** (публичный сайт, `features/auth/account/`) — отдельно от `/auth`, который теперь только для входа/регистрации; залогиненный посетитель `/auth` редиректится на `/account`, либо на `?returnTo=`, если он был передан. Секции (аккордеон, одна открыта одновременно): email (визард выше), пароль (тело формы вынесено из `ChangePasswordPage` в переиспользуемый `PasswordChangeForm`, сам роут `/auth/change-password` **сохранён** — он цель форс-редиректа `forceChangePassword`), телефон (дропдаун стран с поиском, дефолт — автоопределение по IP через `GET api/Geo/Country`), read-only логин/имя/фамилия/роль — **не редактируются, решение Давида**. Старый `AccountPanel.tsx` (блок внутри `/auth` для уже залогиненных) удалён целиком.

**Телефон — дропдаун вместо auto-guess.** Старый `PhoneField` угадывал страну только по уже полностью введённому номеру с кодом — без кода всё читалось как армянский номер (жалоба Давида). Переписан: явный выбираемый `CountrySelect` (SVG-флаги, поиск по названию/коду — новый `Select.searchable`), гео-подсказка меняет выбранную страну ТОЛЬКО пока пользователь не начал печатать и не выбрал вручную сам. Используется и в форме регистрации, и в `/account`.

**SuperAdmin.** `User.IsSuperAdmin` (bool) — ровно один пользователь, заводится ТОЛЬКО через сид (тот же сид-админ, что и раньше; email заодно сменён на `<OWNER_EMAIL>`, `IsSuperAdmin=1` проставлен той же миграцией `UPDATE`). Контекст: раньше (B6, 2026-08-06) роль Admin была неизменяема БЕЗУСЛОВНО — снять её или удалить Admin-аккаунт не мог никто, даже другой админ. Теперь это разрешено ТОЛЬКО SuperAdmin; обычный админ по-прежнему не может сделать кого-либо Admin ни при каких условиях (backend отдаёт 403 `SuperAdminPrivilegeRequired`, даже если запрос уйдёт в обход UI). Проверка SuperAdmin-прав в guard'ах читает `IsSuperAdmin` **из БД у актора**, не из JWT-claim — так отбивается IDOR/прямой запрос. Self-guard: SuperAdmin не может снять/понизить сам себя через `ChangeRole`. Собственный статус SuperAdmin фронт узнаёт из JWT-claim `is_super_admin` (присутствует только если true) — `UserInfoModel`/`UserDetailInfoModel` этого поля НЕ несут никогда, узнать через список/карточку пользователя, кто ещё SuperAdmin, нельзя. Новая confirm-модалка при повышении любого пользователя до роли Admin (`PromoteToAdminModal`, одна на страницу `UsersPage`) — раньше смена роли была обычным `<select>` без подтверждения вообще.

**LoginHistory** — новая таблица (`UserId`, `IpAddress`, `CountryCode`/`CountryName`/`City`, `UserAgent`, `LoggedInAtUtc`), пишется только в `AuthService.LoginAsync` на успешную аутентификацию (НЕ в `RefreshAsync` — ротация токена логином не считается). Видна только в админке, карточка пользователя (`UserDetailPage` → `LoginHistoryList`) — стек карточек-строк, не таблица (375px без переполнения), сноска «показаны последние 100» только при ровно 100 записях. Существующие одиночные `RegisteredIp`/`LastLoginIp` на `User` не убраны — это дополнение, не замена.

**Прод (Azure SQL).** На LocalDB всё применено и проверено живым curl round-trip (create→повышение→понижение→удаление, 403 для обычного админа на Admin-роли/аккаунте, 200 для SuperAdmin). На Azure SQL — применяется отдельным шагом по решению Давида (миграции + `UPDATE` email/`IsSuperAdmin`), не автоматически при деплое кода.

## Доработка (2026-08-02): `User.PhoneNumber`

По запросу Давида добавлено поле `PhoneNumber` (`nvarchar(15)`, required, только цифры, без
unique-индекса) — миграция `AddUserPhoneNumber` (additive `AddColumn`, для NOT NULL пустой
дефолт `""`, таблица `User` была пустой) применена к dev-БД `ATTours` **и** к Azure SQL
(`haytravel-sql`/`free-sql-db-5065137`, через `dotnet ef database update --connection`, т.к.
firewall уже пускал текущую машину по правилу `AllowDevMachine`). Синхронно поле добавлено в
форму регистрации `AuthPage.tsx` (см. «Что НЕ сделано» ниже).

## Что сделано (2026-08-02)

Три новые таблицы в `ATTours.Common/Entities` (+ `Infrastructure/EntityConfiguration`),
зарегистрированы в `ATToursContext`, миграция `AddUserManagement` сгенерирована, прочитана
глазами (чисто additive: `CreateTable`×3 + `InsertData` + `CreateIndex`, без `DropTable`) и
применена к dev-БД `ATTours` (`dotnet ef migrations list` подтверждает — не Pending).

### `UserRole`
| Поле | Тип | Примечание |
|---|---|---|
| `Id` | int PK | |
| `Description` | `nvarchar(256)` required | человекочитаемое название роли, редактируемо |
| `Type` | `RoleType` enum (int) required | `Regular=1`, `TourManager=2`, `Admin=3` — жёстко зашитая тарификация прав, НЕ редактируется |

Засеяно миграцией 3 дефолтные строки (Id 1/2/3, по одной на каждый `RoleType`) — иначе создать
`User` было бы не с каким `RoleId`.

**Права по `Type` (зафиксировано Давидом, но НЕ реализовано — только договорённость на будущее):**
- `Regular` — обычный клиент, никаких админских прав.
- `TourManager` — доступ только к созданию/редактированию туров; удаление тура запрещено, но
  архивация разрешена; больше ничего в админке менять не может, даже если откроет форму
  (значит enforcement должен быть на бэкенде, не только скрытием кнопок во фронте).
- `Admin` — полный доступ, как сейчас.

### `User`
| Поле | Тип | Примечание |
|---|---|---|
| `Id` | int PK | |
| `FirstName` | `nvarchar(128)` required | |
| `LastName` | `nvarchar(128)` nullable | |
| `Username` | `nvarchar(64)` required, unique index | |
| `Email` | `nvarchar(256)` required, unique index | |
| `PhoneNumber` | `nvarchar(15)` required | только цифры (без `+`/пробелов/дефисов), обрезка на фронте; без unique-индекса |
| `Password` | `nvarchar(256)` required | односторонний хеш, см. «Хеширование пароля» ниже |
| `FailedLoginAttempts` | int, default 0 | инкремент на бэкенде при неудачном логине (логика ещё не написана) |
| `LockedUntil` | `datetime2` nullable, **UTC** | выставляется по достижении лимита (5) попыток; см. «Блокировка» ниже |
| `ForceToChangePass` | bit, default false | форсит смену пароля при следующем логине |
| `RoleId` | int FK → `UserRole`, `ON DELETE RESTRICT` | |
| `PasswordRecovery` (nav) | 1:1 опциональный | см. ниже |

### `PasswordRecovery`
Один активный запрос восстановления на юзера (не история) — новый запрос перезаписывает
старый. Решение Давида: писать полноценный лог всех попыток избыточно для текущих нужд.

| Поле | Тип | Примечание |
|---|---|---|
| `Id` | int PK | |
| `UserId` | int FK → `User`, unique index, `ON DELETE CASCADE` | |
| `Token` | `nvarchar(256)` required, unique index | сам механизм генерации/проверки токена ещё не написан |
| `RequestedAtUtc` | `datetime2` required | UTC |
| `RequestIp` | `nvarchar(64)` required | IP запросившего восстановление |
| `UserAgent` | `nvarchar(512)` nullable | браузер/устройство запроса |
| `ExpiresAtUtc` | `datetime2` required | UTC; конкретный TTL (сколько минут/часов) не зафиксирован — решить при реализации сервиса |
| `UsedAtUtc` | `datetime2` nullable | null, пока не использован |

**Контракт при успешном использовании (решение Давида, ещё НЕ реализовано в коде):**
успешный password recovery должен одной транзакцией:
1. Записать `UsedAtUtc = UtcNow` в `PasswordRecovery`.
2. Обнулить у `User`: `FailedLoginAttempts = 0`, `LockedUntil = null`, `ForceToChangePass = false`.

## Ключевые решения, которые нельзя забыть/переспросить

- **Хеширование пароля: BCrypt.** В проекте пока нет ни `BCrypt.Net-Next`, ни ASP.NET Identity —
  пакет **намеренно не добавлен в этой сессии** (нет кода, который бы его использовал: скоуп был
  «только таблицы»). Добавить `BCrypt.Net-Next` в `ATTours.Service` (или туда, где будет жить
  логика логина/регистрации) при реализации.
- **`LockedUntil` — обязательно UTC**, не local time (иначе блокировка «плывёт» в зависимости от
  таймзоны сервера/клиента). Конкретная длительность блокировки после 5-й неудачной попытки
  (15 мин? час? до ручного/recovery-разблокирования?) — **не решена**, решить при реализации
  логина.
- **`RoleType` — enum по образцу `TourType`** (числовые значения, не строки в БД).
- Таблицы размещены в `ATTours.Common/Entities` рядом с остальными сущностями (тот же слой, что
  `Tour`/`Region`/`SiteSetting`) — отдельного bounded context для User не заводили, схема простая.

## Что НЕ сделано (осознанно, по решению Давида — только таблицы в этой сессии)

- Никакого контроллера/сервиса/DTO — ни `Info`/`Create`-моделей, ни `AutoMapper`-профиля.
- Регистрация/логин/логаут — ни бэкенд-эндпоинтов, ни клиентской формы.
- Enforcement прав `TourManager`/`Admin` на бэкенде (авторизация вообще отсутствует в проекте,
  см. `admin-panel.md` — "Авторизации пока нет, но seam заложен").
- Форма регистрации на публичном сайте (редирект с брони → регистрация): FirstName, LastName,
  Email, PhoneNumber, Password, Confirm Password (confirm — только фронтовая валидация, на
  бэкенде не хранится). Это отдельная будущая задача (эндпоинта Register всё ещё нет), здесь
  только зафиксирован её будущий контракт полей. Поле телефона уже добавлено в presentation-only
  `AuthPage.tsx` (2026-08-02): обязательное, `type="tel"`, фильтрация нецифровых символов на
  вводе (`onInput`, не нативный `maxLength` — он режет сырую строку до фильтрации и портит ввод с
  разделителями), обрезка до 15 цифр.
- Логика инкремента `FailedLoginAttempts`/выставления `LockedUntil`/проверки блокировки при логине.
- Генерация/валидация/TTL токена password recovery, отправка письма.

## Как продолжать в новой сессии

1. Прочитать этот файл — даёт полную картину схемы и решений без пересказа.
2. Следующий шаг по цепочке — `backend-architect` для контракта Register/Login/Recovery
   (эндпоинты, DTO, где живёт хеширование, как enforcement ролей встраивается в существующие
   контроллеры), затем `backend-developer` по `new-backend-feature`.
3. Не переспрашивать зафиксированное выше — только то, что явно помечено «не решено».
