---
name: new-backend-feature
description: Scaffold a new backend entity/feature in the ATTours solution (Hay Travel/Backend) following the existing Tour vertical slice — Entity + EntityConfiguration + DTO + DbSet + Init/Create/Info/Update/Delete/Validation services + Controller + AutoMapper profile. Use before implementing a new backend entity; it creates skeletons only, not business logic.
---

# new-backend-feature

Скаффолдит новый вертикальный срез бэкенда в `D:\Davo\Claude AI Agent\Hay Travel\Backend`
(solution `ATTours.slnx`) строго по образцу существующего среза `Tour`. Только скелеты —
бизнес-логику дальше пишет `backend-developer`.

## Шаг 0. Архитектурное решение — сначала `backend-architect`, не импровизировать самому

Этот скилл только скаффолдит по уже принятому архитектурному решению — он не должен сам
решать, где живёт сущность и как она связана с остальными.

1. Если по этой сущности ещё нет решения `backend-architect` (в текущей сессии или ADR в
   `docs/adr/`) — сначала передать задачу агенту `backend-architect`. Он решает: нужна ли
   мультиязычность (отдельная entity-переводов + `LanguageCode`), связи (самостоятельный
   агрегат / ребёнок `Tour`-`TourDay` через FK+cascade / join-сущность как `TourDetail`),
   нужен ли отдельный `DbSet`+миграция, в каком слое что живёт.
2. У Давида (AskUserQuestion) уточнять только то, что не входит в зону архитектора:
   - Имя сущности (PascalCase, единственное число — `Tour`, `RoutePoint`, `Restriction`).
   - Нужен ли полный CRUD-срез (Init/Create/Info/Update/Delete/флаги) или только часть.
3. Дальше следовать решению `backend-architect` буквально — не менять мультиязычность/связи
   по собственному усмотрению.

## Шаг 1. ATTours.Common (всегда)

- `Entities/<Entity>.cs` — `[EntityTypeConfiguration(typeof(<Entity>Configuration))]`,
  `public class <Entity> : EntityBase` (Id из `EntityBase`). FK-поле `<Parent>Id` + nav-свойство
  `<Parent>`; коллекции детей — `public HashSet<TChild> X { get; set; } = [];`.
- Если переводимая:
  - `Entities/<Entity>Translation.cs` (для корневых сущностей исторически
    `<Entity>InfoTranslation` — `TourInfoTranslation`, `TourDayInfoTranslation`;
    для дочерних — `<Entity>Translation`: `RoutePointTranslation`, `RestrictionTranslation`).
    Поля: `<Entity>Id`, `LanguageCode`, `Value`, nav `<Entity>` и **`Type` только если у
    сущности есть смысловой набор полей** (`TourTranslationType`). У `RoutePoint`/`Restriction`/
    `OrganizationalDetail` `Type` нет — на чтении маппится константой 0.
  - `Enums/<Entity>TranslationType.cs` — нумерация с 1 (`Title = 1, ...`), только если `Type` нужен.
- `Infrastructure/EntityConfiguration/<Entity>Configuration.cs` (+ `<Entity>TranslationConfiguration.cs`):
  `IEntityTypeConfiguration<T>`, `builder.ToTable(nameof(<Entity>))`,
  `HasMany(...).WithOne(...).HasForeignKey(...).OnDelete(DeleteBehavior.Cascade)` для детей,
  `HasPrecision(18, 2)` для `decimal`, `IsRequired().HasMaxLength(4000)` для строк,
  `HasIndex` для полей фильтрации, `Navigation(x => ...).AutoInclude()` — только если
  навигация нужна всегда.
- DTO (папка `DTO/`, но **осторожно с namespace** — в проекте они разные):
  - `DTO/Init/<Entity>CreateModel.cs` → namespace `ATTours.Common.Dto.Init` (без Id,
    коллекции детей как `List<XCreateModel>`, переводы как `List<TranslatableCreateModel>`).
  - `DTO/Info/<Entity>InfoModel.cs` → namespace `ATTours.Common.DTO.Info` (с `Id`,
    переводы как `List<TranslatableInfoModel>`).
  - `DTO/Info/<Entity>CreatedModel.cs` — только если create возвращает Id.
  - `DTO/Request/Set<Entity><Flag>Model.cs` → namespace `ATTours.Common.DTO.Request` —
    для точечных PATCH-флагов (образец `SetTourActiveModel`, `SetTourArchivedModel`).
  - Свои `Translatable*Model` **не создавай** — переиспользуй общие
    `TranslatableCreateModel` / `TranslatableInfoModel`.
- `Extensions/LanguageExtensions.cs` — если сущность входит в граф `Tour`, дополни
  `ExtractWithNeededLanguage` фильтрацией её переводов. Отдельный агрегат — свой extension.

## Шаг 2. ATTours.DataLayer

- `ATToursContext.cs` — добавить `public DbSet<<Entity>> <Entity>s { get; set; }`
  (+ DbSet для entity-переводов, как у `TourInfoTranslations`).
- Миграцию **не применять без явного «go» от Давида**. Команда (из `Hay Travel/Backend`):
  `ASPNETCORE_ENVIRONMENT=Development dotnet ef migrations add <Name> --project ATTours.DataLayer --startup-project ATTours.ClientAPI`
- Конкретных репозиториев на сущность в проекте **нет** — не создавай.

## Шаг 3. ATTours.ContextRepository — как правило, не трогаем

Репозитории generic: `EntityRepository<T>` / `IEntityRepository<T>` /
`IEntityQueryableRepository<T>`, база — `RepositoryCoreBase<TEntity, TContextFactory>`.
Новая сущность файлов здесь не добавляет. Если реально нужен новый generic-контракт —
это архитектурное решение: сначала `backend-architect` + ADR.

## Шаг 4. ATTours.Service (assembly `ATTours.BusinessServices`)

Namespace-корень — `ATTours.BusinessServices.*`, не `ATTours.Service`.
Создавай только те сервисы, которые нужны фиче:

| Файл | База / контракт |
| --- | --- |
| `Services/InitServices/<Entity>InitializationService.cs` | `IInitializationService<<Entity>CreateModel>` |
| `Services/CreateServices/<Entity>CreationService.cs` | `CreateVerifiableEntityBase<<Entity>, ATToursContextFactory>` + `override GetEntityValidation()` |
| `Services/InfoServices/<Entity>Info.cs` | `EntityInfoBase<<Entity>>` + `override GetEntityQueryableRepository()` |
| `Services/InfoServices/<Entity>GraphQueryExtensions.cs` | static `Include<Entity>Graph(this IEntityQueryableRepository<<Entity>>)` — единая декларация Include для чтения и для tracked-загрузки в update |
| `Services/UpdateServices/<Entity>UpdateService.cs` | `EntityActionServiceBase<<Entity>, ATToursContextFactory>` + `override ExecuteEntityChangesFactoryAsync()` |
| `Services/UpdateServices/<Entity><Flag>Service.cs` | `RepositoryCoreBase<<Entity>, ATToursContextFactory>` — точечный PATCH-флаг (образец `TourActivationService`) |
| `Services/DeleteServices/<Entity>DeletionService.cs` | `RepositoryCoreBase<<Entity>, ATToursContextFactory>` |
| `Services/ValidationServices/<Entity>ValidationService.cs` | `internal class ... : EntityValidationBase<<Entity>>` — общая для create и update |

Конвенции, обязательные к соблюдению:
- Connection string берётся из `CommonSettings.Instance.ATToursConnectionString`, передаётся
  в базовый конструктор; `CancellationToken cancellationToken = default` — последний параметр.
- Primary constructor допустим там, где нет своего состояния (`TourCreationService`).
- Валидация вызывается из `CreateVerifiableEntityBase.GetEntityValidation()` (create) и явно
  внутри `ExecuteEntityChangesFactoryAsync()` (update) — один и тот же класс валидации.
- Ошибки — только `throw new ErrorModelException(GlobalErrorCode.X, HttpStatusCode.Y, "...")`
  (namespace `ATTours.Exceptions`). Новый код ошибки добавляется в
  `ATTours.Helper/Enums/GlobalErrorCode.cs`, регион `EntityErrors`, следующий свободный номер
  (2004 занят `TourNotFound`), с атрибутом `[Description(...)]`.
- Прямого `DbContext` в сервисах нет — только `EntityRepository` / `new EntityRepository<T>(Context)`.

## Шаг 5. ATTours.Helper — только при новом типе исключения

Новый `IExceptionHandler` в `ExceptionHandlers/` + звено `ExceptionHandlerChainBase` в
`ExceptionHandlerChains/`. Обычная новая сущность сюда добавляет максимум одно значение
`GlobalErrorCode` (см. шаг 4). Try-catch в контроллерах запрещён.

## Шаг 6. ATTours.ClientAPI

- `Controllers/<Entity>Controller.cs` — имя файла = имя класса. (У `Tour` исторический дефект:
  класс `TourController` лежит в `TourInitializationController.cs` — не повторяй это.)
  Скелет: `[ApiController]`, `[Route("api/[controller]")]`,
  `public class <Entity>Controller(IMapper mapper) : Controller`, у каждого экшена явный
  `[Route("...")]` (`Init<Entity>`, `Create<Entity>`, `Update<Entity>`, `GetAll`, `InitUpdate`,
  `Delete<Entity>`), клиентские эндпоинты с `languageCode` — в `#region ClientEndpoints`.
- Текущий стиль вызова сервисов — `using var service = new <Entity>XxxService(); ...`
  (сервисы в DI не регистрируются). Следуй ему. Через DI приходит только `IMapper`.
- `Mapper/MappingProfile.cs` — добавь блок `// ============= Mappings for <ENTITY> =============`
  и три маппинга: `Entity → InfoModel` (сортировка коллекций по `SortOrder`),
  `CreateModel → Entity` (`Id`, FK и nav — `Ignore()`), `InfoModel → Entity`
  (`Id` — `MapFrom`, чтобы update сверял по Id). Для переводов — пары
  `TranslatableCreateModel/TranslatableInfoModel ↔ <Entity>Translation` с кастом
  `(<Entity>TranslationType)src.Type`, а без `Type` — константа `0` на чтении.
- `DependencyInjection/DependencyInjectionConfiguration.cs` (`AddDAL` / `AddServices` /
  `AddValidators`) сейчас пустые, регистрация идёт в `Startup.ConfigureServices`
  (AutoMapper + `AddDbContext<ATToursContext>`), registrar — `DefaultApiServiceRegistrar`
  через `GetServiceRegistrarFactory()`. Если фиче реально нужен сервис через DI — это
  отклонение от текущего стиля: сначала спроси Давида и зафиксируй ADR в `docs/adr/`.

## Шаг 7. Заглушки и передача работы

- Стабы — минимально компилируемые: свойства, пустые тела, `await Task.CompletedTask`.
  `throw new NotImplementedException()` в проекте не используется — не вводи его.
- Никакой бизнес-логики, расчётов, реконсиляции графа и реальной валидации — это
  `backend-developer`.
- `.md`-файлы проекта (`agents.md`, `team.md`, `Hay Travel/docs/*`) не трогай; обновление
  `docs/backend-api.md` и `CHANGELOG.md` — отдельный шаг с разрешения Давида.
- В конце выведи список созданных файлов по проектам + что осталось за `backend-developer`.
