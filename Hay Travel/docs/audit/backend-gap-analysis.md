# Gap-анализ бэкенда ATTours (модель данных + API)

Дата: 2026-07-26. Только анализ, код не менялся.
Корень: `D:\Davo\Claude AI Agent\Hay Travel\Backend`

---

# ЧАСТЬ 1. ФАКТЫ (что реально есть в коде)

## 1.0 Solution и зависимости проектов

`ATTours.slnx`, 6 проектов, `net10.0`, EF Core 10.0.3 + SqlServer, AutoMapper 16.1.1, Newtonsoft.Json, Swashbuckle.

Граф ссылок (по `.csproj`):
- `ClientAPI` → `Common`, `Helper`, `Service` (**на `DataLayer` прямой ссылки нет** — `ATToursContext` в `Startup.cs` приходит транзитивно через `Service`).
- `Service` → `ContextRepository`, `DataLayer`, `Helper`.
- `DataLayer` → `Common`, `ContextRepository`.
- `Helper` → `Common`.
- `Common` → пакеты (в т.ч. FluentValidation — **не используется нигде в коде**).

Пустые заготовленные папки: `Common/DTO/Base`, `Common/DTO/Create`, `DataLayer/Repositories`, `DataLayer/Interfaces`, `Service/Interfaces`.

## 1.1 Сущность Tour (Excursion отдельной сущности НЕТ)

`ATTours.Common/Entities/Tour.cs`. Экскурсия — это тот же `Tour` с `Type = TourType.Excursion`.

**Скалярные поля Tour:**

| Поле | Тип | Конфигурация (`TourConfiguration.cs`) |
| --- | --- | --- |
| `Id` | int | PK identity (из `EntityBase`) |
| `Type` | `TourType` (Tour=1, Excursion=2) | индекс `IX_Tour_Type` |
| `TotalPrice` | `decimal?` | precision(18,2), индекс `IX_Tour_TotalPrice` |
| `IsActive` | bool | публикация на сайте |
| `IsArchived` | bool | soft-delete, индекс `IX_Tour_IsArchived` |
| `MainImageUrl` | string | **required**, nvarchar(4000) |

**Навигации Tour (все Cascade delete):**
- `TourDetails: HashSet<TourDetail>` — join к дням
- `Translations: HashSet<TourInfoTranslation>`
- `AdditionalExpenses: HashSet<AdditionalExpense>`
- `OrganizationalDetails: HashSet<OrganizationalDetail>`
- `Restrictions: HashSet<Restriction>`

**Чего у Tour НЕТ:** регионов, slug'а, дат/сезонности, вместимости/групп, валюты (жёстко AMD на фронте), скидок, рейтинга/отзывов, тегов/категорий, `CreatedAt`/`UpdatedAt`, автора/пользователя.

**Полный граф сущностей (14 таблиц):**

```
Tour ──1:N─→ TourInfoTranslation      (Type: Title|ShortDescription|Description|Duration; LanguageCode; Value)
     ──1:N─→ AdditionalExpense        (Amount decimal?) ──1:N─→ AdditionalExpenseTranslation (Type: Desciption=0)
     ──1:N─→ OrganizationalDetail     (SortOrder)       ──1:N─→ OrganizationalDetailTranslation
     ──1:N─→ Restriction              (SortOrder)       ──1:N─→ RestrictionTranslation
     ──1:N─→ TourDetail  [PK (TourId, TourDayId), SortOrder]  ──N:1─→ TourDay
TourDay ──1:N─→ TourDayInfoTranslation (Type: Title|ShortDescription|Description|Duration)
        ──1:N─→ GalleryImage           (Url required nvarchar(4000), SortOrder)
        ──1:N─→ RoutePoint             (SortOrder)      ──1:N─→ RoutePointTranslation
```

Особенности:
- `TourDetail` — join-таблица с композитным PK `(TourId, TourDayId)` и `SortOrder`. Своего `Id` нет, поэтому дни реконсилятся отдельным кодом.
- `TourDay` **не имеет FK на Tour** — только через join. Поэтому `TourDeletionService` и `TourUpdateService` удаляют `TourDay` явно, через отдельный `EntityRepository<TourDay>`.
- `TourDayConfiguration`: `Navigation(GalleryImages).AutoInclude()` и `Navigation(RoutePoints).AutoInclude()`. `TourDetailConfiguration`: `Navigation(TourDay).AutoInclude()`.
- `IRelatedEntity` (интерфейс для generic `UpdateRelationalEntity`) **ни одной сущностью не реализован** — generic-механизм `UpdateRelationalEntity` / `EntityRelationValidator` в проекте есть, но для Tour не используется.

**Мультиязычность:** нет единого базового класса перевода. 6 независимых `*Translation`-классов, каждый со своим `LanguageCode` + `Value` (+ `Type` только у Tour/TourDay/AdditionalExpense). Интерфейс `ITranslatableModel` есть, но реализует его только DTO `TranslatableCreateModel`, а не сущности. `LanguageCode` = **только Russian=1, English=2** (армянского нет).

**DTO (`ATTours.Common/DTO`):**
- `Init/` (id-less, на создание): `TourCreateModel`, `TourDayCreateModel`, `RoutePointCreateModel`, `GalleryImageCreateModel`, `AdditionalExpenseCreateModel`, `OrganizationalDetailCreateModel`, `RestrictionCreateModel`, `TranslatableCreateModel`.
- `Info/` (с Id, на чтение и на update): `TourInfoModel`, `TourDayInfoModel`, `RoutePointInfoModel`, `GalleryImageInfoModel`, `AdditionalExpenseInfoModel`, `OrganizationalDetailInfoModel`, `RestrictionInfoModel`, `TranslatableInfoModel`, `TourCreatedModel`.
- `Request/`: `SetTourActiveModel {Id, IsActive}`, `SetTourArchivedModel {Id, IsArchived}`.
- `Abstraction/Interfaces/ITranslatableModel`.
- Папка `Base/` и `Create/` — **пустые**. То есть фактическая конвенция «Create/Info», а не «Create/Info/Base» из описания слоёв.

`TourInfoModel` содержит: `Id, Type, IsActive, IsArchived, TotalPrice, MainImageUrl, TourDays[], Translations[], AdditionalExpenses[], OrganizationalDetails[], Restrictions[]`.
`AdditionalExpenseInfoModel` — **без `SortOrder`** (в отличие от Restriction/OrganizationalDetail).

## 1.2 Связь Tour ↔ Region — ОТСУТСТВУЕТ ПОЛНОСТЬЮ

Проверено grep'ом по всему бэкенду: `Region|Marz|Province|Latitude|Longitude|HasData` — **0 совпадений** (единственные хиты `region` — это C#-директивы `#region`).

Фактически:
- Сущности `Region`/`Marz` нет.
- Справочника, enum'а, seed'а регионов нет.
- Связи «тур ↔ регион» нет ни в каком виде (ни M2M, ни FK, ни строкой, ни JSON).
- Тур сейчас **никак** не может быть привязан ни к одному региону, тем более к нескольким.

Регионы существуют только на фронте, как моки: `Frontend/src/shared/data/armeniaMarzes.ts` — 11 марзов с полями `slug` (`yerevan|aragatsotn|ararat|armavir|gegharkunik|kotayk|lori|shirak|syunik|vayots-dzor|tavush`), `ru/en/hy`, `labelAt`, `isEnclave`, `blurb`. Публичный тип `shared/types/tour.ts` уже содержит `regionSlugs: readonly MarzSlug[]` — то есть фронт **уже спроектирован под M2M**, бэк — нет.

## 1.3 RoutePoint / точки маршрута — ЕСТЬ, но в минимальном виде

`ATTours.Common/Entities/RoutePoint.cs`:
```
RoutePoint : EntityBase
    int TourDayId          // FK, Cascade
    int SortOrder
    TourDay TourDay
    HashSet<RoutePointTranslation> Translations   // {LanguageCode, Value} — просто название точки
```

Факты:
- Маршрут хранится **как упорядоченный список текстовых названий внутри конкретного дня**. Точка принадлежит ровно одному дню одного тура (`TourDayId` — обязательный FK), переиспользовать её нельзя.
- **Координат нет** (`Latitude`/`Longitude` отсутствуют) — привязать точку к карте невозможно.
- Региона у точки нет.
- Типа/категории точки (монастырь / озеро / город) нет.
- Изображения у точки нет.
- `RoutePointTranslation.Type` отсутствует как поле; в `MappingProfile` при чтении подставляется константа `0`.
- Валидация `TourValidationService`: **минимум 1 точка маршрута в каждом дне** — обязательное правило.
- Миграция `AddRoutePoint` содержит data-fix: `DELETE FROM TourDayInfoTranslation WHERE Type = 5` (раньше маршрут был текстовым полем дня).

## 1.4 AdditionalCost и Restriction — ЕСТЬ, отдельными таблицами, но tour-scoped

Ни строк, ни JSON — три отдельные полноценные таблицы, каждая с таблицей переводов:

| Сущность | Поля | Переводы | Владелец |
| --- | --- | --- | --- |
| `AdditionalExpense` | `TourId`, `Amount decimal?` | `AdditionalExpenseTranslation {Type: Desciption=0, LanguageCode, Value}` | Tour, Cascade |
| `Restriction` | `TourId`, `SortOrder` | `RestrictionTranslation {LanguageCode, Value}` | Tour, Cascade |
| `OrganizationalDetail` | `TourId`, `SortOrder` | `OrganizationalDetailTranslation {LanguageCode, Value}` | Tour, Cascade |

`Restriction` и `OrganizationalDetail` — **структурно идентичные близнецы** (одинаковые поля, одинаковые конфигурации, одинаковые DTO, одинаковые блоки маппинга). Различаются только именем.

Ключевой факт: **все три — строго tour-scoped**. `TourId` — обязательный FK. Переиспользовать «Входные билеты» между 20 турами нельзя: при создании каждого тура текст вводится заново и физически дублируется в БД. Никакого каталога/шаблона/справочника нет. В `AdditionalExpense` нет `SortOrder` (порядок не хранится).

## 1.5 Глобальные настройки сайта (Settings / SiteSettings) — ОТСУТСТВУЮТ

- Сущности/таблицы `SiteSetting`/`AppSetting`/`HeroImage` нет.
- Контроллера настроек нет.
- Эндпоинта чтения публичных настроек нет.
- Есть только настройки **приложения** из конфигурации (`ATTours.Common/Settings`): `ApplicationSettingsBase<T>` (singleton поверх `IConfigurationRoot`), `CommonSettings { ATToursConnectionString, AccessKey }`, `RegexSettings`. Это read-only-конфиг из `appsettings*.json`, не редактируемый контент.

Hero-изображение сейчас — хардкод на фронте: `Frontend/src/features/home/components/HeroSection.tsx`, `const HERO_IMAGE = '/placeholders/tatev.svg'`.

**Про «без авторизации»:** авторизации в API нет вообще — ни `[Authorize]`, ни аутентификации в `Startup`. CORS: `AllowAnyOrigin/AnyMethod/AnyHeader`. То есть сегодня публичный эндпоинт настроек тривиально сделать — но и админские write-эндпоинты (`CreateTour`, `DeleteTour`, `SetActive`) тоже открыты всем.

## 1.6 Изображения — только URL строкой, загрузки файлов нет

- `Tour.MainImageUrl` — `string`, required, nvarchar(4000).
- `GalleryImage { TourDayId, Url (required, 4000), SortOrder }` — галерея привязана **к дню**, не к туру. У экскурсии (1 день) это де-факто галерея тура.
- Загрузки файлов нет: grep по `IFormFile|UseStaticFiles|wwwroot|Upload|multipart` — 0 совпадений. Нет `app.UseStaticFiles()`, нет папки `wwwroot`, нет интеграции с S3/облаком.
- Валидации формата URL нет (`RegexSettings`/`RegexHelper` существуют, но к URL не применяются).
- У `RoutePoint`, `Restriction`, `OrganizationalDetail`, `AdditionalExpense` изображений нет.

Итог: админ вставляет внешний URL руками. Фронт сейчас использует локальные заглушки `public/placeholders/*.svg`.

## 1.7 Контроллеры и эндпоинты

**Контроллер ровно один.** Файл `ATTours.ClientAPI/Controllers/TourInitializationController.cs`, класс внутри — `TourController` (имя файла и класса расходятся), маршрут `api/Tour`.

| Метод | Route | Вход | Выход | Сервис |
| --- | --- | --- | --- | --- |
| GET | `api/Tour/InitTour?type=` | `TourType` | `TourCreateModel` | `TourInitializationService` |
| POST | `api/Tour/CreateTour` | `TourCreateModel` | `TourCreatedModel {Id}` | `TourCreationService` |
| PUT | `api/Tour/UpdateTour` | `TourInfoModel` | `TourInfoModel` | `TourUpdateService` |
| PATCH | `api/Tour/SetActive` | `SetTourActiveModel` | void | `TourActivationService` |
| PATCH | `api/Tour/SetArchived` | `SetTourArchivedModel` | void | `TourArchivalService` |
| DELETE | `api/Tour/DeleteTour?id=` | int | void | `TourDeletionService` |
| GET | `api/Tour/GetAll` | — | `List<TourInfoModel>` (`!IsArchived`) | `TourInfo` |
| GET | `api/Tour/GetArchived` | — | `List<TourInfoModel>` (`IsArchived`) | `TourInfo` |
| GET | `api/Tour/InitUpdate?id=` | int | `TourInfoModel` (полный граф) | `TourInfo` |
| GET | `api/Tour/GetToursClient?languageCode=` | int | `List<TourInfoModel>` | `TourInfo` |
| GET | `api/Tour/GetTourInfo?id=&languageCode=` | int, int | `TourInfoModel` | `TourInfo` |

**Важно:** `GetToursClient` вызывает `info.GetAllAsync()` **без фильтра** — возвращает и неопубликованные (`IsActive=false`), и архивные туры. Публичный сайт сейчас увидел бы черновики. Это фактический баг контракта, а не гипотеза.

Фильтрация языка — постобработка в памяти (`LanguageExtensions.ExtractWithNeededLanguage` мутирует загруженный граф через `RemoveWhere`), не в SQL.

**Сервисы (`ATTours.Service/Services/`):** `InitServices/TourInitializationService`, `CreateServices/TourCreationService`, `UpdateServices/{TourUpdateService, TourActivationService, TourArchivalService}`, `DeleteServices/TourDeletionService`, `InfoServices/{TourInfo, TourGraphQueryExtensions}`, `ValidationServices/TourValidationService`.

**DI:** `DependencyInjectionConfiguration.AddDAL/AddServices/AddValidators` — **все три метода пустые**. Контроллер создаёт сервисы через `new XxxService(...)` и `using`. Через DI инжектится только `IMapper`. `services.AddDbContext<ATToursContext>()` зарегистрирован, но **никто его из DI не резолвит** — каждый сервис поднимает свой контекст через `ATToursContextFactory` + connection string из `CommonSettings`.

**Обработка ошибок:** middleware `InitializableMiddlewareBase<ATToursExceptionMaster>` → цепочка `ErrorModelExceptionHandlerChain → ATToursExceptionHandlerChain → MsSqlContextExceptionHandlerChain`. Ошибки бизнес-слоя бросаются как `ErrorModelException(GlobalErrorCode, HttpStatusCode, message)`. Коды — enum `ATTours.Helper/Enums/GlobalErrorCode` (сейчас 2000-2004 для entity-ошибок, `TourNotFound = 2004`). Новые ошибки добавляются кодом в этот enum, новая цепочка не нужна.

## 1.8 Миграции EF Core

- **Провайдер:** SQL Server (`Microsoft.EntityFrameworkCore.SqlServer` 10.0.3). Локально LocalDB.
- **Контекст:** `ATTours.DataLayer/ATToursContext.cs` (14 `DbSet`) + partial с транзакциями. Конфигурации сущностей — **не в `OnModelCreating`**, а атрибутами `[EntityTypeConfiguration(typeof(XxxConfiguration))]` на каждой сущности; сами конфигурации лежат в `ATTours.Common/Infrastructure/EntityConfiguration/`.
- **Миграции:** `ATTours.DataLayer/Migrations/` — 5 штук:
  1. `20260329112751_InitialCreate`
  2. `20260720184149_AddRoutePoint` (+ `DELETE FROM TourDayInfoTranslation WHERE Type = 5`)
  3. `20260720192023_AddOrganizationalDetailAndRestriction`
  4. `20260722212041_ChangeTourDayChildrenToCascade`
  5. `20260723210010_AddTourIsArchived`
- **Как накатываются:** вручную (`dotnet ef database update` / VS). `MigrationExtensions.MigrateDatabase<TContext>()` в `ContextRepository` существует, но **не вызывается нигде** — автоприменения на старте нет. По чек-листу `dorabotki-checklist.txt` миграции прогоняются только после явного «go» от Давида.
- **Seed-данных нет вообще.** `HasData` не используется ни в одной конфигурации, data-миграций с INSERT нет.
- **Строка подключения — два разных механизма и рассинхрон:**
  - `appsettings.json` → `ConnectionStrings:ATTours` = `...Database=ATTour...` — **этим ключом никто не пользуется**.
  - `appsettings.Development.json` → корневой ключ `ATToursConnectionString` = `...Database=ATTours...` — **вот его читает** `CommonSettings.ATToursConnectionString` (`Configuration.GetSection("ATToursConnectionString")`).
  - Следствие: вне Development (`appsettings.json` не содержит ключа `ATToursConnectionString`) строка подключения будет `null`. Плюс имена БД различаются (`ATTour` vs `ATTours`).
- `ApplicationSettingsBase` строит собственный `ConfigurationBuilder` от `Directory.GetCurrentDirectory()`, независимо от хостового `IConfiguration`.

## 1.9 Сквозные факты, влияющие на любую новую фичу

1. **Мёртвый параллельный стек абстракций.** `DataLayer/RepositoryBase<TEntity>` + `Service/ServiceBase<TEntity>` + `Common/.../IRepositoryBase`, `IServiceBase` — ни одной реализации, папки `Repositories`/`Interfaces` пустые. Рабочий стек — `ContextRepository` (`IEntityRepository` / `IEntityQueryableRepository` / `IIncludableQueryableRepository` + `RepositoryCoreBase<TEntity, TContextFactory>`). Новый код нужно вести по второму, иначе разъедется окончательно.
2. **Generic `DataConversion`-база используется частично.** `EntityCreationService` / `CreateVerifiableEntityBase` реально работают (`TourCreationService`). А `UpdateRelationalEntity` / `EntityRelationValidator` / `IRelatedEntity` — не используются: `TourUpdateService` написан вручную (ручной reconcile-by-id по всем уровням графа, ~180 строк).
3. **Нет авторизации** и нет разделения admin/public контрактов — публичные эндпоинты живут в том же контроллере под `#region ClientEndpoints`.
4. **`LanguageCode` без армянского** — фронт публичного сайта заявляет RU/EN/HY.
5. **Нет пагинации/фильтров** — `GetAll` тянет весь граф всех туров (`IncludeTourGraph` с 8 Include/ThenInclude) целиком.
6. **Нет аудита** (`CreatedAt`/`UpdatedAt`/автор) ни у одной сущности.

---

# ЧАСТЬ 2. GAP-ЛИСТ

## G-A. Регионы у тура (many-to-many, карта 11 марзов)

**Чего не хватает:** всего. Ни справочника, ни связи, ни seed'а, ни эндпоинта.

### Предлагаемая структура (по образцу вертикального среза Tour)

**Entity — `ATTours.Common/Entities/`:**
```
Region : EntityBase
    string Slug            // 'yerevan' ... 'tavush' — стабильный ключ, синхронный с MarzSlug на фронте
    int SortOrder          // порядок в списках/фильтрах
    HashSet<RegionTranslation> Translations
    HashSet<TourRegion> TourRegions

RegionTranslation : EntityBase
    int RegionId
    LanguageCode LanguageCode
    string Value           // название марза
    Region Region

TourRegion : EntityBase          // join, по образцу TourDetail
    int TourId
    int RegionId
    int SortOrder                // порядок регионов в карточке тура
    Tour Tour
    Region Region
```
`Tour` дополняется `HashSet<TourRegion> TourRegions = []`.

Замечание по PK join-таблицы: у `TourDetail` PK композитный `(TourId, TourDayId)` без своего `Id`, и именно это заставило писать ручной reconcile дней. Для `TourRegion` **рекомендую свой `Id` + уникальный индекс на `(TourId, RegionId)`** — тогда связь реконсилится штатным `ReconcileCollection`-подходом и не тянет отдельный код.

**EntityConfiguration — `Common/Infrastructure/EntityConfiguration/`:** `RegionConfiguration` (`ToTable`, `Slug` required maxLength 64 + unique index, `HasMany(Translations).Cascade`, **`HasData` на 11 марзов**), `RegionTranslationConfiguration` (`Value` required 400, `HasData` на 22 строки перевода RU+EN), `TourRegionConfiguration` (два `HasOne...WithMany`, unique index `(TourId, RegionId)`, `OnDelete(Cascade)` от Tour и `Restrict` от Region — регион нельзя удалить, пока он в турах).

**DbSet:** `Regions`, `RegionTranslations`, `TourRegions` в `ATToursContext`.

**Миграция:** `AddRegionAndTourRegion` — 3 таблицы + `HasData`-инсерты 11 регионов и 22 переводов.

**DTO — `Common/DTO/`:**
- `Info/RegionInfoModel { Id, Slug, SortOrder, List<TranslatableInfoModel> Translations }`
- `Info/TourRegionInfoModel { Id, RegionId, Slug, SortOrder }` — плоский, чтобы `TourInfoModel` не тянул весь регион с переводами
- `Init/TourRegionCreateModel { int RegionId, int SortOrder }`
- В `TourInfoModel` → `List<TourRegionInfoModel> Regions`; в `TourCreateModel` → `List<TourRegionCreateModel> Regions`.

**Repository:** отдельных конкретных репозиториев не нужно — generic `EntityRepository<Region>` через `RepositoryCoreBase<Region, ATToursContextFactory>` покрывает всё, ровно как у Tour.

**Service — `ATTours.Service/Services/`:**
- `InfoServices/RegionInfo : EntityInfoBase<Region>` с переопределённым `GetEntityQueryableRepository()` → `.Include(x => x.Translations)`. Плюс метод счётчиков туров по регионам для карты (`GET RegionsWithTourCount`).
- `TourGraphQueryExtensions.IncludeTourGraph()` — добавить `.Include(x => x.TourRegions).ThenInclude(tr => tr.Region)`.
- `TourCreationService` — ничего не меняется, если маппер соберёт `TourRegions` (валидация существования `RegionId` — в `TourValidationService`).
- `TourUpdateService` — добавить один вызов `ReconcileCollection(existing.TourRegions, incoming.TourRegions, ...)` (при своём `Id` у join'а — тривиально).
- `TourValidationService` — новое правило: все `RegionId` существуют; минимум 1 регион (**решение Давида — обязательно ли?**).

**Controller:** новый `RegionController` (`api/Region`) — `GET GetAll?languageCode=`, `GET GetAllWithTourCount?languageCode=`. Плюс `Tour/GetToursClient` дополнить фильтром `?regionId=` или `?regionSlug=`.

**Mapper:** ~4 блока `CreateMap` в `MappingProfile` (Region→Info, RegionTranslation→Translatable, TourRegion→Info, TourRegionCreate/Info→TourRegion).

**Новый код ошибок:** `GlobalErrorCode.RegionNotFound = 2005`.

**Оценка:** entity + config + seed + миграция — ~0.3 дня; врезка в create/update/read-граф + mapper + DTO — ~0.4 дня; контроллер регионов + счётчики — ~0.2 дня. **Итого ≈ 1 рабочий день бэкенда.** Плюс фронт (админ-форма: мультиселект регионов; публичный: замена моков на API).

---

## G-B. Переиспользуемые справочники RoutePoint / AdditionalCost / Restriction

**Чего не хватает:** справочников как таковых. Сейчас все три сущности — жёстко tour/day-scoped, значения дублируются в БД при каждом создании тура.

Общий паттерн решения — **«каталог + ссылка с override»**: заводится каталог (`*Template`/`Place`), а существующая tour-scoped сущность получает **nullable FK на каталог** и сохраняет собственные поля как override. Правило разрешения (`override ?? template`) живёт **в Service-слое** (Info-сервисы/мапперы), не в репозитории и не в БД.

Это даёт обратную совместимость: старые записи с `TemplateId = null` продолжают работать как «кастомное значение тура», новые могут ссылаться на каталог.

### B-1. RoutePoint → каталог мест (`Place`)

```
Place : EntityBase                          // справочник мест Армении
    string Slug
    int? RegionId                           // место принадлежит марзу — связывает G-A и карту
    decimal? Latitude                        // decimal(9,6)
    decimal? Longitude                       // decimal(9,6)
    string ImageUrl                          // nullable, nvarchar(4000)
    bool IsActive
    HashSet<PlaceTranslation> Translations   // {LanguageCode, Type: Name|Description, Value}
    Region Region

RoutePoint : EntityBase                      // ИЗМЕНЯЕТСЯ: остаётся привязкой к дню
    int TourDayId
    int SortOrder
    int? PlaceId                             // NEW, nullable → ссылка на каталог
    Place Place                              // NEW
    HashSet<RoutePointTranslation> Translations   // остаются как override названия
```
Разрешение имени точки: `RoutePoint.Translations` непусты → берём их; иначе `Place.Translations`.
Координаты для карты берутся из `Place` (у самой точки координат не будет — иначе два источника правды).

Миграция: `AddPlaceCatalog` — таблицы `Place`, `PlaceTranslation`, колонка `RoutePoint.PlaceId` (nullable, `OnDelete(Restrict)`) + индекс. Существующие данные не ломаются.

DTO: `PlaceInfoModel`, `PlaceCreateModel`; `RoutePointInfoModel`/`RoutePointCreateModel` дополняются `int? PlaceId` (+ в Info — денормализованные `PlaceSlug`, `Latitude`, `Longitude` для карты).
Service: `Services/InfoServices/PlaceInfo`, `Services/CreateServices/PlaceCreationService` (через `CreateVerifiableEntityBase`), `Services/UpdateServices/PlaceUpdateService`, `Services/ValidationServices/PlaceValidationService`.
Controller: `PlaceController` — `GetAll`, `InitCreate`, `Create`, `Update`, `SetActive`, `Delete` (delete запрещать, если используется в турах → `Restrict` + понятная 409/400).

**Оценка:** полный вертикальный срез новой сущности + врезка в RoutePoint ≈ **1.5–2 дня**.

### B-2. AdditionalExpense → `ExpenseTemplate`

```
ExpenseTemplate : EntityBase
    string Code                              // 'entrance-tickets', 'lunch' — устойчивый ключ
    decimal? DefaultAmount
    bool IsActive
    HashSet<ExpenseTemplateTranslation> Translations   // {LanguageCode, Value}

AdditionalExpense : EntityBase               // ИЗМЕНЯЕТСЯ
    int TourId
    decimal? Amount                          // override суммы
    int SortOrder                            // NEW — сейчас порядка нет вообще
    int? ExpenseTemplateId                   // NEW, nullable
    HashSet<AdditionalExpenseTranslation> Translations   // override текста
```
Разрешение: `Amount ?? Template.DefaultAmount`, `Translations` непусты ? они : `Template.Translations`.

**Оценка:** ≈ 0.7 дня (сущность проще — нет координат/региона/картинки).

### B-3. Restriction (и OrganizationalDetail) → `TourNoteTemplate`

`Restriction` и `OrganizationalDetail` структурно идентичны. Два варианта — см. развилку R-4.

Минимальный вариант (без слияния сущностей):
```
RestrictionTemplate : EntityBase   { string Code, bool IsActive, HashSet<RestrictionTemplateTranslation> Translations }
Restriction         : + int? RestrictionTemplateId

OrganizationalDetailTemplate : EntityBase { ... то же самое ... }
OrganizationalDetail         : + int? OrganizationalDetailTemplateId
```
Вариант со слиянием: один каталог `TourNoteTemplate` с дискриминатором `NoteKind { Restriction = 1, OrganizationalDetail = 2 }` — вдвое меньше таблиц/DTO/маппингов, но требует ADR (это уже отход от «одна сущность = одна таблица», как сейчас).

**Оценка:** 2 раздельных каталога ≈ 1.2 дня; один общий `TourNoteTemplate` ≈ 0.7 дня.

**Итого по G-B: 3–4 рабочих дня бэкенда** (плюс сопоставимый объём на фронте — экраны управления справочниками в админке; сегодня их нет ни одного).

**Важно:** это самая тяжёлая часть, и большая её часть — не БД, а **админский UI управления справочниками**. Без него каталог наполнять нечем.

---

## G-C. Глобальные настройки сайта (hero image URL и т.п.)

**Чего не хватает:** всего — сущности, эндпоинта, публичного контракта.

### Вариант, который рекомендую: key-value таблица + типизированный фасад в Service

```
SiteSetting : EntityBase
    string Key            // 'hero.imageUrl', 'contacts.phone', 'social.instagram'
    string Value          // nvarchar(4000)
    bool IsPublic         // true → отдаётся без авторизации
    HashSet<SiteSettingTranslation> Translations   // опционально, для переводимых значений
```
`SiteSettingConfiguration`: unique index на `Key`, `Value` maxLength(4000), `HasData` на стартовый набор ключей.
Миграция: `AddSiteSettings` (1–2 таблицы + seed).

**Почему key-value, а не «одна строка с типизированными колонками»:** каждый новый пункт настроек в типизированном варианте = новая колонка = новая миграция. При key-value добавление настройки — это seed-строка или просто запись через админку.

**Как сохранить типизированный контракт наружу** (чтобы фронт не разбирал словарь):
- `Common/DTO/Info/PublicSiteSettingsModel { string HeroImageUrl; string HeroTitleRu; ... }` — типизированный DTO.
- `Service/Services/InfoServices/SiteSettingsInfo : EntityInfoBase<SiteSetting>` — читает `IsPublic == true` и собирает типизированный DTO по ключам.
- `Service/Services/UpdateServices/SiteSettingsUpdateService` — upsert по `Key`.

**Controller:** новый `SiteSettingsController` (`api/SiteSettings`):

| Метод | Route | Доступ | Возврат |
| --- | --- | --- | --- |
| GET | `api/SiteSettings/GetPublic` | публично | `PublicSiteSettingsModel` |
| GET | `api/SiteSettings/GetAll` | админ (когда появится auth) | `List<SiteSettingInfoModel>` |
| PUT | `api/SiteSettings/Update` | админ | `List<SiteSettingInfoModel>` |

Сегодня «без авторизации» получается автоматически — авторизации нет ни на одном эндпоинте. Но `GetPublic` надо сразу проектировать как отдельный endpoint с фильтром `IsPublic`, чтобы при появлении auth не пришлось резать контракт.

**Оценка:** entity + config + seed + миграция + info/update сервисы + контроллер + маппинги ≈ **0.5 дня**. Самый дешёвый пункт из трёх.

---

## G-D. Сопутствующие gap'ы (всплыли при анализе, не были в задании)

| # | Gap | Влияние | Оценка |
| --- | --- | --- | --- |
| D-1 | `GetToursClient` не фильтрует `IsActive`/`IsArchived` — публичный сайт увидит черновики и архив | **Баг контракта.** Блокирует запуск публичного сайта на реальном API | 15 мин |
| D-2 | `LanguageCode` без `Armenian` — фронт заявляет RU/EN/HY | При добавлении HY придётся дописывать переводы во **все** 6+ таблиц переводов и в `TourInitializationService` | 0.5 дня + контент |
| D-3 | Нет авторизации — `DeleteTour`/`CreateTour` открыты всем | Блокер продакшена | 1–2 дня |
| D-4 | Строка подключения: в Production `ATToursConnectionString` отсутствует (в `appsettings.json` лежит неиспользуемый `ConnectionStrings:ATTours`, БД называется иначе) | Приложение не поднимется вне Development | 15 мин |
| D-5 | `GetAll` без пагинации тянет полный граф всех туров | Деградация при росте каталога; для публичного списка нужен «лёгкий» `TourListItemModel` вместо полного `TourInfoModel` | 0.5 дня |
| D-6 | DI не используется (`new Service()` в контроллере, пустые `AddDAL/AddServices`) | С добавлением 3–4 новых контроллеров (Region, Place, SiteSettings, шаблоны) проблема умножается | 0.5–1 день на перевод существующего + новые сразу через DI |
| D-7 | Нет `CreatedAt`/`UpdatedAt` | Нельзя сортировать «новые туры», нет аудита | 0.3 дня |
| D-8 | Изображения — только внешний URL, загрузки нет | Заказчик не сможет заливать фото из админки | отдельная задача, 1–2 дня |

---

# ЧАСТЬ 3. РАЗВИЛКИ — НУЖНО РЕШЕНИЕ ДАВИДА

### R-1. Reusable-справочники: каталог с override vs копия значений в туре
- **Вариант A — «каталог + nullable FK + override»** (описан выше). Плюсы: правка текста «Входные билеты» разом во всех турах; шаблоны переиспользуются; данные не дублируются. Минусы: две модели существования одной сущности (со ссылкой и без), правило разрешения `override ?? template` в Service, нужен админ-UI управления каталогами.
- **Вариант B — «каталог только как шаблон, при выборе значения копируются в тур»** (copy-on-select). Плюсы: БД и чтение остаются как сейчас, никакого `??`-разрешения; тур самодостаточен. Минусы: правка шаблона **не** доедет до уже созданных туров.
- **Вариант C — оставить как есть** (всё вводится руками в каждом туре).
> Ключевой вопрос: **должна ли правка справочника задним числом менять уже опубликованные туры?** Да → A. Нет → B. Не нужно вообще → C.
> Моё мнение: для `AdditionalCost` и `Restriction` достаточно **B** (там важнее скорость ввода, чем сквозная правка). Для `RoutePoint` нужен **A** — потому что место на карте обязано быть одной сущностью с одними координатами, иначе карта развалится на дубли.

### R-2. Место маршрута: `Place` как отдельный каталог vs координаты прямо в `RoutePoint`
- **A. Каталог `Place`** (Slug + Region + Lat/Lng + фото). Нужен, если планируется страница места, фильтр «туры с посещением Гарни», кластеризация точек на карте.
- **B. Просто добавить `Latitude`/`Longitude` (+`RegionId`) в существующий `RoutePoint`.** Дёшево (одна миграция, 0.3 дня), карта заработает сразу. Минус: Татев в 12 турах = 12 записей с 12 (возможно, разными) парами координат.
> Вопрос: **точки маршрута — это самостоятельные объекты сайта, или просто подписи внутри дня?**

### R-3. Регионы: где источник правды по названиям марзов
- **A. Полноценный `Region` + `RegionTranslation` с seed'ом в БД.** Названия редактируются админом, бэк — источник правды.
- **B. `Region` в БД только как `Slug` + связь, названия/геометрия/блёрбы остаются на фронте** в `armeniaMarzes.ts`. Дешевле (нет таблицы переводов, нет seed'а переводов), но названия регионов в двух местах.
> Также: **обязателен ли регион у тура** (минимум 1) или можно тур без региона? Влияет на `TourValidationService` и на карту (тур без региона не появится нигде).
> И: где хранить геометрию SVG-путей — она сейчас на фронте (~37KB, lazy-чанк). **Рекомендую оставить на фронте**, в БД не тащить: это ассет отрисовки, не данные домена.

### R-4. `Restriction` и `OrganizationalDetail` — оставить двумя сущностями или слить
Они структурно идентичны (`TourId + SortOrder + переводы`). При добавлении каталогов это дублирование удваивается (2 каталога, 2 таблицы переводов, 2 набора DTO, 2 контроллера, ~8 блоков маппинга).
- **A. Слить в `TourNote` + enum `NoteKind`** — вдвое меньше кода, но это ломающее изменение существующего API (`TourInfoModel.Restrictions`/`OrganizationalDetails` → один список) и требует data-миграции.
- **B. Оставить раздельно** — API не ломается, дублирование сохраняется.
> Если сливать — то **сейчас**, до появления каталогов, иначе цена решения удвоится.

### R-5. SiteSettings: key-value vs типизированная строка-синглтон
- **A. Key-value** (`Key`/`Value`/`IsPublic`) + типизированный фасад в Service. Новая настройка = строка, без миграции.
- **B. Одна сущность `SiteSettings` с колонками** `HeroImageUrl`, `HeroTitle`, `ContactPhone`... Типобезопасно на уровне БД, но каждая новая настройка = миграция.
> Рекомендую **A** — набор настроек будет расти непредсказуемо. Но нужно решение: **должны ли значения настроек быть переводимыми** (hero-заголовок RU/EN/HY) — если да, добавляется `SiteSettingTranslation` и объём растёт на ~0.2 дня.

### R-6. Порядок работ
Предлагаю: **G-C (0.5д) → D-1 + D-4 (0.5ч) → G-A (1д) → G-B (3–4д)**.
Обоснование: `SiteSettings` дешевле всех и разблокирует hero; D-1 — реальный баг публичного контракта; регионы разблокируют главный интерактивный модуль сайта (карту) и одновременно нужны каталогу `Place`; справочники — самый дорогой пункт, и его объём напрямую зависит от решений R-1/R-2/R-4.

### R-7. Отдельно: DI (D-6)
Сейчас контроллер делает `new XxxService()`, регистрация сервисов пустая. Добавление 3–4 новых контроллеров тем же способом закрепит паттерн. Развилка: **новые фичи делать сразу через DI** (тогда в решении сосуществуют два стиля) или **сначала перевести существующий Tour-срез на DI** (+0.5–1 день до старта новых фич), или **осознанно продолжать в текущем стиле**.

---

# ПРИЛОЖЕНИЕ: карта файлов (абсолютные пути)

- Сущности: `D:\Davo\Claude AI Agent\Hay Travel\Backend\ATTours.Common\Entities\`
- EF-конфигурации: `...\ATTours.Common\Infrastructure\EntityConfiguration\`
- DTO: `...\ATTours.Common\DTO\{Init,Info,Request,Abstraction}\`
- Enums: `...\ATTours.Common\Enums\` (`TourType`, `LanguageCode`, `TourTranslationType`, `TourDayTranslationType`, `ExpenseTranslationType`, `SymbolType`)
- Контекст + миграции: `...\ATTours.DataLayer\ATToursContext.cs`, `...\ATTours.DataLayer\Migrations\`
- Фабрика контекста: `...\ATTours.DataLayer\ATToursContextFactory.cs`
- Абстракции репозиториев: `...\ATTours.ContextRepository\RepositoryAbstraction\Relational\`
- Generic-базы сервисов: `...\ATTours.Service\DataConversion\Core\`
- Сервисы Tour: `...\ATTours.Service\Services\{CreateServices,UpdateServices,DeleteServices,InfoServices,InitServices,ValidationServices}\`
- Контроллер: `...\ATTours.ClientAPI\Controllers\TourInitializationController.cs` (класс `TourController`)
- Маппинг: `...\ATTours.ClientAPI\Mapper\MappingProfile.cs`
- DI-заглушки: `...\ATTours.ClientAPI\DependencyInjection\DependencyInjectionConfiguration.cs`
- Startup: `...\ATTours.ClientAPI\Startup.cs`
- Коды ошибок: `...\ATTours.Helper\Enums\GlobalErrorCode.cs`
- Фронт-контракт регионов (моки): `D:\Davo\Claude AI Agent\Hay Travel\Frontend\src\shared\data\armeniaMarzes.ts`
- Фронт hero-хардкод: `D:\Davo\Claude AI Agent\Hay Travel\Frontend\src\features\home\components\HeroSection.tsx`
