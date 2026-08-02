# ЭТАП 3 (бэк) — общий файл-статус для субагентов

Единая точка синхронизации между `backend-architect`, `backend-developer`,
`backend-tester`, `backend-code-reviewer` в рамках этапа 3.

**Правила работы с этим файлом:**
1. Любой субагент этапа 3 читает его **первым**, до начала работы.
2. Перед завершением дописывает сюда все принятые решения и изменения контрактов
   (имена сущностей, полей, DTO, маршрутов, названия миграций).
3. Ничего отсюда не удалять — только дописывать и помечать статус.

Контекст всей работы: `big-update-2026-07.md` (замороженные решения, что сделано).
Оперативные статусы: `../checklist-big-update.txt`.
Аудит бэка (не переделывать заново): `audit/`.
Архитектурное решение по 3.1–3.3: `backend-stage3-architecture.md`.
ADR: `adr/001`, `adr/002`, `adr/003`.

---

## Замороженные решения, влияющие на бэк

- Языки — только **RU/EN**. Добавление третьего языка должно оставаться дешёвым.
- Регионы — **сущность в БД**; SVG-геометрия остаётся на фронте как ассет отрисовки.
- `SiteSettings` — **key-value** с переводами и флагом публичности, чтобы новая
  настройка не требовала миграции.
- `Restriction` + `OrganizationalDetail` **сливаются** в одну сущность с полем `Type`.
- Справочники — **ссылка на каталог + per-tour override** («override ?? шаблон»
  разрешается в слое Service).
- Новые контроллеры пишутся **в текущем стиле проекта** (без DI); перевод бэка
  на DI — отдельная задача техдолга, не смешивать.
- Связь тур↔регион — со **своим Id**, не композитным ключом (иначе повторится
  боль `TourDetail`).

---

## Журнал решений и изменений

### 2026-07-29 — старт этапа 3
- Файл заведён главным агентом. Разрешение Давида на правку `.md` в рамках
  этапа 3 получено явно.
- Запущены параллельно: `backend-developer` на 3.0 (блокеры),
  `backend-architect` на 3.1–3.3 (архитектурное решение).

### 2026-07-29 — backend-developer, 3.0 (блокеры) закрыт

**1. `GetToursClient` не фильтровал `IsActive`/`IsArchived`**
- `Tour.IsActive` (публикация) и `Tour.IsArchived` — независимые bool-флаги
  (`ATTours.Common/Entities/Tour.cs:13,16`).
- Фильтрация уже строится на уровне `IQueryable` (не в памяти) через
  `EntityInfoBase<TEntity>.GetAllAsync(Expression<Func<TEntity,bool>> where)` →
  `GetQueryableRepository(where).Where(where)` (`ATTours.Service/Core/Info/EntityInfoBase.cs:27-34`),
  этот паттерн уже применялся в админских `GetAll`/`GetArchived`
  (`ATTours.ClientAPI/Controllers/TourInitializationController.cs:79,88`).
- Правка — только вызов в клиентском эндпоинте:
  `TourInitializationController.cs:106` — `info.GetAllAsync()` →
  `info.GetAllAsync(x => x.IsActive && !x.IsArchived)`.
- Админские выборки (`GetAll`, `GetArchived`, `InitUpdate`) НЕ тронуты — видят
  черновики/архив как и раньше.
- ДОПОЛНЕНИЕ 2026-07-29 (координатор попросил закрыть сразу, не откладывать
  на 3.5 — вторая половина того же блокера): `GetTourInfo`
  (`TourInitializationController.cs`, тот же `#region ClientEndpoints`,
  публичный — принимает `languageCode`, вызывает `ExtractWithNeededLanguage`)
  резолвил тур по id через `info.InitUpdate(id)` без фильтра
  `IsActive`/`IsArchived` — при известном id можно было получить черновик/
  архивный тур через публичный эндпоинт.
  ИСПРАВЛЕНО: после `info.InitUpdate(id)` добавлена проверка
  `tour is not { IsActive: true, IsArchived: false }` → бросается тот же
  `ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.NotFound,
  $"Tour with id {id} not found.")`, что уже используется в
  `TourUpdateService`/`TourArchivalService`/`TourActivationService`/
  `TourDeletionService` (существующий паттерн `?? throw new
  ErrorModelException(...)`, обрабатывается существующей цепочкой
  `ErrorModelExceptionHandlerChain` → `ATToursExceptionMaster`). Ответ для
  «нет такого id» и «есть, но черновик/архив» — идентичный 404 с одним и тем
  же кодом/сообщением, по ответу нельзя определить существование скрытого
  тура. Админский `InitUpdate` (`TourInitializationController.cs:93-98`,
  использует тот же `TourInfo.InitUpdate`) не тронут — админка по-прежнему
  видит черновики/архив по id для редактирования.
  БАГ ДО ФИКСА (подтверждено анализом кода, не прогоном запроса к живому
  API — окружения с БД под рукой не было): при несуществующем/скрытом id
  `info.InitUpdate(id)` возвращал `null`, а `null.ExtractWithNeededLanguage(...)`
  (`ATTours.Common/Extensions/LanguageExtensions.cs:9`, первая же строка —
  `tour.Translations.RemoveWhere(...)`) обращается к члену null-объекта →
  `NullReferenceException` → нетипизированный 500 вместо внятной ошибки.
  Теперь недопустимый/скрытый тур перехватывается раньше вызова
  `ExtractWithNeededLanguage`, NRE невозможен.

**2. Строка подключения была рабочей только в Development**
- Причина падения вне Development была двойная:
  - `appsettings.json` (базовый, читается во всех окружениях) хранил ключ
    `ConnectionStrings:ATTours` — секция/имя, которые нигде в коде не читаются
    (мёртвый конфиг, полное несовпадение путей).
  - Код (`ATTours.Common/Settings/CommonSettings.cs:5` было) читает плоский
    top-level ключ `ATToursConnectionString` через
    `Configuration.GetSection(nameof(ATToursConnectionString)).Value` —
    он существовал только в `appsettings.Development.json`.
  - `ApplicationSettingsBase<T>.Configuration` (`ATTours.Common/Settings/ApplicationSettingsBase.cs:17-23`)
    собирает свою независимую конфигурацию: `appsettings.json` (optional) →
    `appsettings.{ASPNETCORE_ENVIRONMENT}.json` (optional) → `AddEnvironmentVariables()`.
    Env vars уже поддерживались архитектурой — это не менялось.
- Исправлено:
  - **NB (сверено с кодом 29.07.2026): в `appsettings.json` эта правка не
    доехала.** Ранее здесь было записано, что мёртвый блок `ConnectionStrings`
    убран и вместо него добавлен плейсхолдер `"ATToursConnectionString": ""`
    (+ `"AccessKey": ""`). В файле этого нет: блок `ConnectionStrings:ATTours`
    остался на месте (`Database=ATTour`, ключ по-прежнему никем не читается),
    плейсхолдера правильного ключа нет, а от правки осталась только висячая
    запятая после строки подключения и изменённые отступы. Следствие: вне
    Development `ATToursConnectionString` так и отсутствует — теперь это
    приводит не к `null`, а к `InvalidOperationException` из `CommonSettings`
    (см. следующий пункт, он в коде есть). Правку `appsettings.json` надо
    доделать отдельно.
  - `appsettings.Development.json` — рабочее значение для локальной разработки;
    в ходе этапа 3 файл ломался, 29.07.2026 Давид вернул его вручную.
  - `ATTours.Common/Settings/CommonSettings.cs` — геттер
    `ATToursConnectionString` теперь бросает `InvalidOperationException` с
    внятным сообщением, если значение пустое/отсутствует (вместо того, чтобы
    отдать `null` дальше в `UseSqlServer`/`SqlConnection` и получить
    малопонятную ошибку глубоко в стеке). `AccessKey` не трогал — вне скоупа.
  - Прод/стейджинг должны переопределять `ATToursConnectionString` через
    переменную окружения с тем же именем (`ATToursConnectionString=...`) или
    user-secrets — благодаря `AddEnvironmentVariables()` доп. маппинг не нужен.

**Сборка (после GetToursClient + appsettings/CommonSettings)**: `dotnet build
ATTours.slnx` — Build succeeded, 0 Errors, 30 Warnings (все существовавшие
ранее: NU1903 Microsoft.OpenApi advisory + CS8618/CS8603/CS8619/CS8625/
CS0168 в проектах с `<Nullable>disable`/существующих паттернах — ни один не
введён этой правкой).

**Сборка (после GetTourInfo), чистая**: `dotnet build ATTours.slnx
--no-incremental` — Build succeeded, 0 Errors, 30 Warnings — набор идентичен
базовому (NU1903 + CS8618/CS8603/CS8619/CS8625/CS0168 в
ContextRepository/DataLayer/Service/Helper), `ATTours.ClientAPI` — 0 warnings.
Полный прогон API (Swagger/.http) с реальной БД не делался — нет окружения с
поднятой БД под рукой.

Затронутые файлы:
- `ATTours.ClientAPI/Controllers/TourInitializationController.cs` (фильтр
  `GetToursClient` + not-found-фильтр `GetTourInfo`, usings `ATTours.Exceptions`,
  `ATTours.Helper.Enums`, `System.Net`)
- `ATTours.ClientAPI/appsettings.json`
- `ATTours.Common/Settings/CommonSettings.cs`

---

### 2026-07-29 — backend-architect, решение по 3.1 / 3.2 / 3.3

Полный документ: **`backend-stage3-architecture.md`**. Здесь — только сводка
принятых контрактов, чтобы её не пришлось выуживать из большого файла.
Реализация не написана: это решение, дальше работает `backend-developer`.

Замороженные решения не переигрывались. Спорные места вынесены в развилки
D-1…D-4 (§7 архитектурного документа) — решает Давид.

#### Общее

- Namespace слоя Service — `ATTours.BusinessServices.*`; `ATToursContextFactory`
  лежит в `ArmeniaTours.DataLayer`; `TourCreateModel` — в `ATTours.Common.Dto.Init`
  (строчное `Dto`). Не сюрприз, а факт кода — учитывать при написании usings.
- Новые контроллеры — текущий стиль (`new XxxService()` + `using`), без DI.
  Но у всех новых сервисов оставить конструктор с `IApplicationDbContext`,
  чтобы перевод на DI позже был механическим.
- Новые коды ошибок: `GlobalErrorCode.SiteSettingKeyUnknown = 2005`,
  `GlobalErrorCode.RegionNotFound = 2006`. Новые цепочки обработчиков не нужны.
- Папки `DTO/Base` и `DTO/Create` остаются пустыми — не использовать.

#### 3.1 SiteSettings

- **Сущности:** `SiteSetting { Key(unique,128), Value(4000,nullable) }` +
  `SiteSettingTranslation { SiteSettingId, LanguageCode, Value }`. `Type` у перевода
  нет (маппер отдаёт `0`, как у `RestrictionTranslation`).
- **Метаданные ключа в БД НЕ хранятся** — группа, тип контрола, переводимость,
  публичность, порядок и дефолт живут в коде:
  `ATTours.Common/Infrastructure/SiteSettings/SiteSettingCatalog.cs` +
  `SiteSettingDefinition.cs`. Слияние «каталог ⟵ БД» — в `SiteSettingsInfo`.
  Ключ без строки в БД возвращается с `Id = 0` и дефолтом каталога. → ADR 002,
  статус Proposed (развилка D-1).
- **Enums:** `SettingValueType { Text=1, MultilineText=2, Url=3, ImageUrl=4 }`,
  `SiteSettingGroup { Hero=1, Contacts=2, Social=3, Branding=4, Seo=5 }`.
  Все значения — строки; `ValueType` — только подсказка рендера/валидации.
- **Ключи:** `<группа>.<camelCase>`. Стартовый набор — 18 ключей (hero ×5,
  branding ×1, contacts ×4, social ×5, seo ×3), таблица в §3.1.4.
- **Разрешение значения (в Service):** `перевод(язык) ?? Value ?? DefaultValue`.
  Следствие: третий язык не ломает сайт — до заполнения переводов отдаётся
  язык-нейтральное значение, а не `null`.
- **DTO:** `Info/SiteSettingInfoModel`, `Info/SiteSettingsPublicModel
  { int LanguageCode; Dictionary<string,string> Values }`,
  `Request/SiteSettingUpdateModel { Key, Value, List<TranslatableCreateModel> Translations }`.
- **Сервисы:** `InfoServices/SiteSettingsInfo : EntityInfoBase<SiteSetting>`
  (`GetMergedAsync()`, `GetPublicAsync(languageCode, group?)`),
  `UpdateServices/SiteSettingsUpdateService : EntityActionServiceBase<SiteSetting, ATToursContextFactory>`
  (`UpsertAsync()`), `ValidationServices/SiteSettingsValidationService : EntityValidationBase<SiteSetting>`.
- **Upsert идёт по `Key`**, не по `Id`. Переводы внутри настройки сверяются
  **по `LanguageCode`**, не по `Id` — осознанное отличие от reconcile-по-Id
  в графе тура (граф тура при этом не трогается).
- **Контроллер** `api/SiteSettings` (`SiteSettingsController.cs`, имя файла = имени класса):
  `GET GetPublic?languageCode=&group=` → `SiteSettingsPublicModel`;
  `GET GetAll` → `List<SiteSettingInfoModel>` (оба языка);
  `PUT Update` (`List<SiteSettingUpdateModel>`) → `List<SiteSettingInfoModel>`.
  Отдельного `Init` нет — `GetAll` уже возвращает каталог с дефолтами.
  Неизвестный `Key` в `Update` → 400 `SiteSettingKeyUnknown`.
- **Миграция:** `AddSiteSettings` (2 таблицы, unique index на `Key`, **без `HasData`**).
- **Контракт API не ломается.** Админка до 4.1 ничего не замечает.

#### 3.2 Region

- **Сущности:** `Region { Slug(unique,64), SortOrder }`,
  `RegionTranslation { RegionId, RegionTranslationType Type, LanguageCode, Value(400) }`,
  `TourRegion : EntityBase { TourId, RegionId, SortOrder }` — **со своим Id**
  (замороженное). `Tour` += `HashSet<TourRegion> TourRegions`.
- `RegionTranslationType { Name = 1, Blurb = 2 }`. Сидим только `Name`; `blurb`
  пока остаётся на фронте, перенос позже — **без миграции**.
- **Конфигурации:** unique index `Region.Slug`; unique index `(TourId, RegionId)`;
  `Tour → TourRegion` = `Cascade`, `Region → TourRegion` = `Restrict`
  (регион нельзя удалить, пока он в турах). `TourDeletionService` менять не нужно.
- **Сид — raw SQL в отдельной миграции, не `HasData`** (в проекте `HasData` нет
  нигде; прецедент рукописного SQL — `AddRoutePoint`). → ADR 001, Accepted.
  Регионы вставляются без явных `Id`, переводы — `SELECT`-ом с сопоставлением
  по `Slug`. Слаги и RU/EN дословно из
  `Frontend/src/shared/data/armeniaRegions.ts`, `SortOrder` = индекс в массиве
  фронта (0 `yerevan` … 10 `tavush`). SVG-геометрия в БД не переносится.
- **Региона у `RoutePoint` НЕ будет** — географию точки получит каталог `Place`
  в 3.4, второй источник правды заводить нельзя.
- **DTO:** `Info/RegionInfoModel { Id, Slug, SortOrder, TourCount, Translations }`,
  `Info/TourRegionInfoModel { Id, RegionId, Slug, SortOrder }` (плоский, без
  вложенного региона), `Init/TourRegionCreateModel { RegionId, SortOrder }`.
  `TourInfoModel` += `Regions`, `TourCreateModel` += `Regions`.
- **Сервис:** `InfoServices/RegionInfo : EntityInfoBase<Region>` —
  `GetEntityQueryableRepository()` + `Include(Translations)`;
  `Task<Dictionary<int,int>> GetPublicTourCountsAsync()` (счётчик считается
  проекцией в SQL по правилу `IsActive && !IsArchived`; сшивка со списком —
  в контроллере).
- `TourGraphQueryExtensions.IncludeTourGraph()` += одна ветка
  `Include(TourRegions).ThenInclude(tr => tr.Region)` (переводы региона в граф
  тура НЕ включаются).
- `TourUpdateService` += один `ReconcileCollection(existing.TourRegions, ...)`.
- **`TourValidationService` меняет базовый класс** на
  `EntityValidationContextDependentBase<Tour, ATToursContextFactory>` (в проекте
  он есть и не используется) — нужна БД для проверки существования `RegionId`.
  Оба вызывающих передают свой `Context`, лишнего подключения не появляется.
  Новые правила: `RegionId` не повторяются; все `RegionId` существуют →
  иначе 400 `RegionNotFound`.
- `LanguageExtensions` += перегрузки `ExtractWithNeededLanguage` для `Region`.
- **Контроллер** `api/Region` (`RegionController.cs`):
  `GET GetAll` → `List<RegionInfoModel>` (оба языка, с `TourCount`);
  `GET GetRegionsClient?languageCode=` → одна локаль, с `TourCount`.
  CRUD регионов в 3.2 не входит.
- **Фильтр `?region=` (slug, не Id)** — в существующем `GetToursClient`,
  дополнительным `&&` к предикату, который уже положил 3.0:
  `x => x.IsActive && !x.IsArchived && x.TourRegions.Any(tr => tr.Region.Slug == region)`.
  Новый метод в `TourInfo` не нужен — `EntityInfoBase.GetAllAsync(where)` уже есть.
  Неизвестный slug → **пустой список**, не 400.
- **Контрактное правило `UpdateTour`:** `Regions == null` = «не трогать регионы»,
  `Regions == []` = «очистить все». Осознанная асимметрия с остальными
  коллекциями графа — защита от стирания регионов админкой в окне между 3.2 и 4.4.
  Снять после 4.4. Должно попасть в `backend-api.md`.
- **Миграции:** `AddRegionAndTourRegion` (схема) → `SeedArmenianRegions` (данные).
- **Контракт API не ломается** (только новые поля + новый контроллер).

#### 3.3 Слияние Restriction + OrganizationalDetail

- **Имена:** `TourNote`, `TourNoteTranslation`,
  `TourNoteType { OrganizationalDetail = 1, Restriction = 2 }` (имя `TourNote`
  уже зафиксировано в чек-листе 3.3 и в плане 3.4 `TourNoteTemplate`).
- **Форма перехода: новая таблица + перенос данных, НЕ переименование
  `Restriction`.** → ADR 003, Accepted. Причина: переименование тянет цепочку из
  4 объектов (2 таблицы, FK-колонка, индексы/constraint'ы) — сценарий, где EF
  генерирует `Drop`+`Create` вместо `Rename` и молча теряет данные; плюс
  асимметрия `Id`.
- **Миграция данных** — одна, `MergeRestrictionAndOrganizationalDetailIntoTourNote`:
  создать `TourNote` с временными колонками `LegacyId`/`LegacySource` → перелить
  обе стороны → перелить переводы `JOIN`-ом по этой паре → удалить временные
  колонки → `DROP` четырёх старых таблиц. `Down()` возможен, но `Id` не
  восстанавливает: тестировать на копии БД.
- **Сортировка — ВСЕГДА внутри типа:** `Where(Type == X).OrderBy(SortOrder)`.
  После слияния у тура два независимых диапазона `0..n-1`. Индекс `(TourId, Type)`.
- **Удаляются:** 4 сущности, 4 EF-конфигурации, 4 DTO. **Добавляются:**
  `TourNote`, `TourNoteTranslation`, `TourNoteType`, 2 конфигурации,
  `Info/TourNoteInfoModel { Id, Type, SortOrder, Translations }`,
  `Init/TourNoteCreateModel { Type, SortOrder, Translations }`.
  `Tour.OrganizationalDetails` + `Tour.Restrictions` → `Tour.Notes`.
  `ATToursContext`: 4 `DbSet` → 2.
- Правятся: `TourConfiguration` (2 `HasMany` → 1), `TourGraphQueryExtensions`
  (2 `Include` → 1), `TourUpdateService` (2 `ReconcileCollection` → 1),
  `TourInitializationService` (`Notes = []`), `LanguageExtensions` (2 цикла → 1),
  `MappingProfile` (~8 блоков → 5, `Notes` мапится с `.OrderBy(Type).ThenBy(SortOrder)`).
  `TourDeletionService` — без изменений.
- **ЛОМАЕТ КОНТРАКТ API:** `organizationalDetails` + `restrictions` → `notes`
  в `TourInfoModel`, `TourCreateModel` и в ответе `InitTour`.
  **Фронт админки — 3 файла:** `shared/types/attours.ts`,
  `features/admin/lib/tourMapper.ts` (8 мест: ~115-119, 142-147, 256-260, 329-334),
  `features/admin/lib/enums.ts` (+`TourNoteType`).
  **UI и вью-модель формы НЕ меняются** — `tourMapper.ts` по своей же
  документации единственное место, знающее wire ↔ view-model; поля вью-модели
  `organizationalDetails`/`restrictions` остаются. Публичный сайт не затронут
  (он на моках). Альтернатива «оставить два списка в API» — развилка D-3.

#### Порядок миграций (линейный, зафиксирован)

1. `AddSiteSettings` (3.1)
2. `AddRegionAndTourRegion` (3.2, схема)
3. `SeedArmenianRegions` (3.2, данные)
4. `MergeRestrictionAndOrganizationalDetailIntoTourNote` (3.3)

3.3 идёт последней намеренно — это единственный ломающий пункт, он должен
накатываться вместе с правкой админки. Миграции накатываются вручную и только
после явного «go» от Давида.

#### Развилки, ожидающие решения Давида (детали — §7 архитектурного документа)

- **D-1.** SiteSettings: метаданные ключа в коде (рекомендую) или колонками в БД.
- **D-2.** Обязателен ли регион у тура. Рекомендую «нет» — иначе `UpdateTour`
  начнёт отвечать 400 на любой существующий тур.
- **D-3.** Ломать ли контракт тура ради `notes` (рекомендую да, цена — 3 файла
  фронта) или оставить два списка в API.
- **D-4.** Логотип: один ключ (рекомендую) или пара под светлую/тёмную тему.

---

### 2026-07-29 — РЕШЕНИЯ ДАВИДА по развилкам D-1…D-4 (ЗАМОРОЖЕНЫ)

Давид ответил по всем четырём — везде выбрана рекомендация архитектора.
Переспрашивать и переигрывать нельзя.

- **D-1 = метаданные ключа в КОДЕ, каталогом.** В БД только `SiteSetting`
  (`Key` + `Value`) и `SiteSettingTranslation`. Группа, тип контрола,
  переводимость, публичность, порядок и дефолт — в
  `SiteSettingCatalog.cs`. Админка новые ключи заводить не умеет; новая
  настройка = одна строка каталога + деплой бэка, но **без миграции**.
  Неизвестный `Key` в `Update` → 400 `SiteSettingKeyUnknown`.
  ADR 002 переводится из Proposed в **Accepted**.
- **D-2 = регион у тура пока НЕОБЯЗАТЕЛЕН.** Валидация «хотя бы один регион»
  не вводится: сейчас регионов нет ни у одного тура, и обязательность сразу
  сломала бы сохранение всех существующих туров в админке. Ужесточение —
  после пункта 4.4 (выбор регионов в форме тура), отдельной задачей.
- **D-3 = контракт API ЛОМАЕМ.** В API один список `notes` с полем `Type`
  вместо `organizationalDetails` + `restrictions`. Правятся три файла
  админки (`shared/types/attours.ts`, `features/admin/lib/tourMapper.ts`,
  `features/admin/lib/enums.ts`); UI и вью-модель формы не меняются.
- **D-4 = логотип ОДИН ключ** `branding.logoUrl`. Пара под светлую/тёмную
  тему при необходимости добавляется позже одной строкой каталога.

**Порядок реализации** (задан главным агентом, менять нельзя): 3.1 → 3.2 →
3.3. Пункты идут строго последовательно, не параллельно — они делят
`ApplicationDbContext`, `MappingProfile`, `GlobalErrorCode` и `TourInfoModel`,
и параллельные правки этих файлов гарантируют конфликт.

### 2026-07-29 — backend-developer, 3.1 SiteSettings (реализовано)

Реализован **только** пункт 3.1. Файлы 3.2 (Region) и 3.3 (TourNote) не
создавались и не готовились. `Tour` и его граф, `TourInfoModel`, tour-блоки
`MappingProfile`, `Restriction`, `OrganizationalDetail`, `RoutePoint`,
`TourInitializationController` не тронуты. Фронтенд не тронут.

#### Созданные файлы

`ATTours.Common`
- `Entities/SiteSetting.cs` — `Key`, `Value`, `HashSet<SiteSettingTranslation> Translations`.
- `Entities/SiteSettingTranslation.cs` — `SiteSettingId`, `LanguageCode`, `Value`, nav.
  Поля `Type` нет (как у `RestrictionTranslation`).
- `Enums/SettingValueType.cs` — `Text=1, MultilineText=2, Url=3, ImageUrl=4`.
- `Enums/SiteSettingGroup.cs` — `Hero=1, Contacts=2, Social=3, Branding=4, Seo=5`.
- `Infrastructure/SiteSettings/SiteSettingDefinition.cs` — `Key`, `Group`,
  `ValueType`, `IsTranslatable`, `IsPublic`, `SortOrder`, `DefaultValue`,
  `DefaultTranslations`.
- `Infrastructure/SiteSettings/SiteSettingCatalog.cs` — `All`, `ByKey(key)`,
  `IsKnown(key)`; 18 ключей из §3.1.4 архитектурного документа, логотип — один
  ключ `branding.logoUrl` (D-4).
- `Infrastructure/EntityConfiguration/SiteSettingConfiguration.cs` — `Key`
  required 128 + unique index, `Value` 4000 nullable, `HasMany(Translations)`
  → Cascade.
- `Infrastructure/EntityConfiguration/SiteSettingTranslationConfiguration.cs` —
  `Value` 4000 nullable.
- `DTO/Info/SiteSettingInfoModel.cs`, `DTO/Info/SiteSettingsPublicModel.cs`,
  `DTO/Request/SiteSettingUpdateModel.cs`.

`ATTours.DataLayer`
- `ATToursContext.cs` — `DbSet<SiteSetting> SiteSettings`,
  `DbSet<SiteSettingTranslation> SiteSettingTranslations`.
- `Migrations/20260729181120_AddSiteSettings.cs` (+ `.Designer.cs`,
  обновлён `ATToursContextModelSnapshot.cs`).

`ATTours.Helper`
- `Enums/GlobalErrorCode.cs` — `SiteSettingKeyUnknown = 2005`
  (`[Description("Site setting key is unknown.")]`). `RegionNotFound = 2006`
  НЕ добавлялся — это 3.2, чтобы не занимать чужой файл заранее.

`ATTours.Service` (namespace `ATTours.BusinessServices.*`)
- `Services/InfoServices/SiteSettingsInfo.cs` — `GetMergedAsync()`,
  `GetPublicAsync(languageCode, group?)`, `static ResolveValue(...)`.
- `Services/UpdateServices/SiteSettingsUpdateService.cs` — `UpsertAsync()`.
- `Services/ValidationServices/SiteSettingsValidationService.cs`.

`ATTours.ClientAPI`
- `Controllers/SiteSettingsController.cs` — `GET GetAll`, `PUT Update`,
  `GET GetPublic?languageCode=&group=` (в `#region ClientEndpoints`).
- `Mapper/MappingProfile.cs` — блок `SITESETTING` + `SiteSettingTranslation`
  в секции переводов + приватный `ApplyCatalogMetadata`.

#### Решения, принятые самостоятельно (архитектурный документ их не задавал)

1. **`DefaultValue` у всех 18 ключей — пустая строка, `DefaultTranslations`
   пустые.** Реальных дефолтных текстов (hero-заголовок, телефон, ссылки) в
   документах нет, и выдумывать их нельзя. Следствие: до заполнения из админки
   `GetPublic` отдаёт пустые строки, а не выдуманный контент. Заполнение
   дефолтов — одна строка каталога, без миграции.
2. **`ResolveValue` заканчивается `?? string.Empty`.** Архитектурное правило —
   `перевод(язык) ?? Value ?? DefaultValue`; при всех трёх пустых получился бы
   `null`, что противоречит §3.1.4 («`GetPublic` никогда не отдаёт `null` для
   известного ключа»). Пустая строка = «не заполнено».
3. **Переводы учитываются только у ключей с `IsTranslatable = true`.** У
   язык-нейтрального ключа (`social.instagramUrl` и т.п.) случайно
   присланный перевод не подменит `Value`.
4. **`GetAll` (merged) отдаёт сохранённую строку как есть, без подстановки
   дефолта.** Дефолт каталога подставляется только для ключа, которого в БД
   ещё нет (`Id = 0`). Иначе админка не смогла бы отличить «сохранено пусто»
   от «никогда не заполнялось». Разрешение с дефолтом — только в `GetPublic`.
5. **Ключ сравнивается `StringComparer.Ordinal`** (каталог, слияние, upsert).
   Ключ — часть контракта API, а не пользовательский ввод. Замечание: в SQL
   Server unique index по умолчанию регистронезависим, поэтому `Hero.Title`
   в `Update` вернёт 400 `SiteSettingKeyUnknown` раньше, чем дойдёт до БД.
6. **Строка в БД, ключ которой убрали из каталога, наружу не отдаётся, но и не
   удаляется** — слияние идёт от каталога. Удаление осиротевших строк — вопрос
   эксплуатации, не кода.
7. **Валидация проверяет три вещи:** неизвестный/пустой `Key` → 400
   `SiteSettingKeyUnknown`; дубль `Key` в одном запросе → 400
   `InvalidEntityRelation`; дубль `LanguageCode` внутри одной настройки → 400
   `InvalidEntityRelation`. Длина значения и формат URL НЕ валидируются:
   `RegexSettings`/`RegexHelper` в проекте к URL нигде не применяются, новое
   правило вводить не стал (это же сказано в §3.1.5).
8. **`SortOrder` в каталоге — глобальный 0..17** в порядке таблицы §3.1.4
   (hero → branding → contacts → social → seo), merged-список сортируется по
   нему. Группировка в UI — по полю `Group`.
9. **`UpsertAsync` после `SaveChanges` строит ответ через
   `new SiteSettingsInfo(Context, CancellationToken)`** — переиспользует
   слияние вместо его дублирования. Экземпляр намеренно не оборачивается в
   `using`: контекстом владеет update-сервис, чужой `Dispose` закрыл бы
   соединение раньше времени.
10. **У `SiteSettingsUpdateService` два конструктора** —
    `(List<SiteSetting>, CancellationToken)` и
    `(List<SiteSetting>, IApplicationDbContext, CancellationToken)`; у
    `SiteSettingsInfo` — три (как у `TourInfo`). Перевод на DI позже —
    механический.

#### Отступлений от архитектурного документа нет

Расхождений документа с реальным кодом не обнаружено: namespace-ловушки
(`ATTours.BusinessServices.*`, `ArmeniaTours.DataLayer.ATToursContextFactory`,
`ATTours.Common.Dto.Init`) подтвердились и учтены; `DTO/Base` и `DTO/Create`
не использовались. Контроллер — в текущем стиле (`new XxxService()` + `using`,
через DI только `IMapper`).

#### Проверки

- **Базовый прогон до правок:** `dotnet build ATTours.slnx --no-incremental` →
  `Build succeeded. 30 Warning(s). 0 Error(s).`
- **После реализации (включая файлы миграции):**
  `dotnet build ATTours.slnx --no-incremental` → `Build succeeded.
  30 Warning(s). 0 Error(s).` — набор предупреждений тот же, что базовый
  (NU1903 + CS86xx/CS0168 в предсуществующем коде); ни одного предупреждения
  в новых файлах (проверено фильтром по `SiteSetting` в выводе сборки).
- **Миграция сгенерирована командой EF, не руками:**
  `ASPNETCORE_ENVIRONMENT=Development dotnet ef migrations add AddSiteSettings
  --project ATTours.DataLayer --startup-project ATTours.ClientAPI` →
  `Build started... Build succeeded. Done. To undo this action, use
  'ef migrations remove'` (плюс предсуществующее предупреждение NU1903).
  Файл `20260729181120_AddSiteSettings.cs`: `CreateTable SiteSetting`
  (`Key nvarchar(128) NOT NULL`, `Value nvarchar(4000) NULL`),
  `CreateTable SiteSettingTranslation` (FK → `SiteSetting`, `ON DELETE CASCADE`),
  `CreateIndex IX_SiteSetting_Key unique: true`,
  `CreateIndex IX_SiteSettingTranslation_SiteSettingId`. `HasData`/`InsertData`
  нет. `Down()` — два `DropTable`.
- **`dotnet ef database update` НЕ запускался** (по заданию: БД под рукой нет).
- **Ручной прогон эндпоинтов через Swagger/.http НЕ делался** — по той же
  причине; фактическое поведение upsert, каскадного удаления переводов и
  валидности конфигурации AutoMapper в рантайме не проверено. Это зона
  `backend-tester`.

#### Для 3.2/3.3 (следующий агент)

- `GlobalErrorCode` теперь занят до **2005**; `RegionNotFound = 2006` свободен.
- В `MappingProfile.cs` появились: секция `SITESETTING` (перед секцией
  переводов), `TranslatableCreateModel → SiteSettingTranslation` в блоке
  «CreateModel → Entity», `SiteSettingTranslation → TranslatableInfoModel` в
  блоке «Entity → InfoModel», приватный метод `ApplyCatalogMetadata` рядом с
  `BuildTourDetails`. Tour-блоки не тронуты.
- В `ATToursContext` добавлены 2 `DbSet` в конец списка.
- Последняя миграция в цепочке — `20260729181120_AddSiteSettings`;
  `AddRegionAndTourRegion` должна генерироваться поверх неё.

---

### 2026-07-29 — backend-developer, 3.2 Region (реализовано)

Реализован **только** пункт 3.2. `Restriction`/`OrganizationalDetail` не
тронуты — это 3.3, следующий агент. Фронтенд не тронут, `armeniaRegions.ts`
только читался.

#### Созданные/изменённые файлы

`ATTours.Common`
- `Entities/Region.cs` — `Slug`, `SortOrder`, `HashSet<RegionTranslation> Translations`,
  `HashSet<TourRegion> TourRegions`.
- `Entities/RegionTranslation.cs` — `RegionId`, `Type (RegionTranslationType)`,
  `LanguageCode`, `Value`, nav. В отличие от `RestrictionTranslation`/
  `SiteSettingTranslation`, `Type` есть и несёт смысл (Name/Blurb).
- `Entities/TourRegion.cs` — join со своим `Id` (`TourId`, `RegionId`, `SortOrder`,
  nav `Tour`/`Region`), как зафиксировано в замороженных решениях.
- `Enums/RegionTranslationType.cs` — `Name = 1, Blurb = 2` (сидим только `Name`).
- `Infrastructure/EntityConfiguration/RegionConfiguration.cs` — `Slug` required 64 +
  unique index; `HasMany(Translations)` → Cascade.
- `Infrastructure/EntityConfiguration/RegionTranslationConfiguration.cs` — `Value`
  required 400.
- `Infrastructure/EntityConfiguration/TourRegionConfiguration.cs` — **оба** FK
  (`Tour`/`Region`) конфигурируются здесь, не в `TourConfiguration` (у join-сущности
  два родителя с разным `OnDelete`): `Tour` → Cascade, `Region` → Restrict; unique
  index `(TourId, RegionId)`.
- `DTO/Info/RegionInfoModel.cs`, `DTO/Info/TourRegionInfoModel.cs` (плоский),
  `DTO/Init/TourRegionCreateModel.cs` (namespace `ATTours.Common.Dto.Init`, строчное
  `Dto`, как у соседних Create-моделей — `RestrictionCreateModel` и т.п.).
- `DTO/Init/TourCreateModel.cs` += `List<TourRegionCreateModel> Regions`.
- `DTO/Info/TourInfoModel.cs` += `List<TourRegionInfoModel> Regions` (с комментарием
  про null/[] контракт прямо на свойстве).
- `Entities/Tour.cs` += `HashSet<TourRegion> TourRegions`.
- `Extensions/LanguageExtensions.cs` += `ExtractWithNeededLanguage(Region, int)` и
  коллекционная перегрузка. Метод для `Tour` не тронут — переводы региона в граф
  тура не едут (`TourRegionInfoModel` плоский).

`ATTours.DataLayer`
- `ATToursContext.cs` — `DbSet<Region>`, `DbSet<RegionTranslation>`,
  `DbSet<TourRegion>` в конец списка.
- `Migrations/20260729182434_AddRegionAndTourRegion.cs` (+ `.Designer.cs`,
  обновлён `ATToursContextModelSnapshot.cs`) — схема, сгенерирована `dotnet ef
  migrations add`, без ручных правок.
- `Migrations/20260729182454_SeedArmenianRegions.cs` (+ `.Designer.cs`) —
  сгенерирована пустой командой `dotnet ef migrations add` (модель не менялась),
  тело `Up`/`Down` дописано вручную raw SQL (ADR 001).

`ATTours.Helper`
- `Enums/GlobalErrorCode.cs` — `RegionNotFound = 2006`
  (`[Description("Region not found.")]`).

`ATTours.Service` (namespace `ATTours.BusinessServices.*`)
- `Services/InfoServices/RegionInfo.cs` — `EntityInfoBase<Region>`,
  `GetEntityQueryableRepository()` += `Include(Translations)`,
  `GetPublicTourCountsAsync(CancellationToken)`.
- `Services/InfoServices/TourGraphQueryExtensions.cs` — добавлена ветка
  `Include(TourRegions).ThenInclude(Region)` (без переводов региона).
- `Services/InitServices/TourInitializationService.cs` — `InitAsync()` теперь
  проставляет `Regions = new List<TourRegionCreateModel>()` (симметрично
  `OrganizationalDetails`/`Restrictions`), чтобы `InitTour` → `CreateTour`
  round-trip не присылал `Regions == null` без необходимости.
- `Services/ValidationServices/TourValidationService.cs` — база сменена на
  `EntityValidationContextDependentBase<Tour, ATToursContextFactory>`
  (единственный конструктор — `(List<Tour> entities, IApplicationDbContext context)`,
  второго, по строке подключения, не заводил — оба вызывающих всегда передают
  свой `Context`, неиспользуемый конструктор добавлять не стал). Новая
  `ValidateRegionsAsync`: дубли `RegionId` → 400 `InvalidEntityRelation`;
  несуществующий `RegionId` → 400 `RegionNotFound`. Пропускается полностью,
  если `TourRegions` пуст/`null` (регион необязателен, решение D-2).
- `Services/CreateServices/TourCreationService.cs` — `GetEntityValidation()`
  теперь передаёт `Context` в `TourValidationService`.
- `Services/UpdateServices/TourUpdateService.cs` — вызов валидации передаёт
  `Context`; добавлен `ReconcileCollection(existing.TourRegions, ...)`,
  **обёрнутый в `if (incoming.TourRegions is not null)`** — это и есть
  реализация контрактного правила null/[] (см. ниже).

`ATTours.ClientAPI`
- `Controllers/RegionController.cs` (новый) — `GET GetAll`, `GET
  GetRegionsClient?languageCode=` (оба в стиле `new RegionInfo()` + `using`,
  без DI, только `IMapper` через конструктор).
- `Controllers/TourInitializationController.cs` — `GetToursAsyncClient`
  (`GetToursClient`) получил необязательный параметр `string? region = null`
  (nullable — проект собирается с `Nullable enable`, `string region = null`
  без `?` даёт новый CS8625); при непустом `region` предикат дополняется
  `&& x.TourRegions.Any(tr => tr.Region.Slug == region)`. `GetTourInfo` и
  админские методы не тронуты.
- `Mapper/MappingProfile.cs` — блоки `REGION`, `TOURREGION`; `Tour →
  TourInfoModel` += `Regions` (`OrderBy(SortOrder)`); `TourCreateModel/
  TourInfoModel → Tour` += `TourRegions` (`MapFrom(src.Regions)`); перевод
  `RegionTranslation → TranslatableInfoModel` (`Type` — реальное значение
  `(int)src.Type`, НЕ константа 0, в отличие от Restriction/OrganizationalDetail/
  RoutePoint/SiteSetting — у региона `Type` семантический). Обратных мапперов
  `TranslatableCreateModel/TranslatableInfoModel → RegionTranslation` нет —
  CRUD регионов не входит в 3.2, писать было бы мёртвым кодом.

#### Контрактное правило null/[] для `Regions` — как реализовано технически

Механизм: `AutoMapper` сконфигурирован с `AllowNullCollections = true`
(`Startup.cs`). В `CreateMap<TourInfoModel, Tour>()` `TourRegions` замаплен
явным `MapFrom(src => src.Regions)`. Если `TourInfoModel.Regions == null`
(поле отсутствует в JSON) — AutoMapper проставляет `Tour.TourRegions = null`
(перекрывая дефолтный `= []` инициализатор сущности). Если `Regions == []` —
получается пустой `HashSet<TourRegion>`. `TourUpdateService` затем проверяет
именно `incoming.TourRegions is not null`, прежде чем звать
`ReconcileCollection` — сам `ReconcileCollection` трактует `null` как «удалить
всё» (`incoming ?? []`), поэтому вызывать его безусловно было нельзя. Это
единственный технический механизм, реализующий контракт §3.2.9 архитектурного
документа — если в будущем кто-то уберёт explicit `MapFrom` у `TourRegions`
(например, заменит на конвенцию по имени), это правило тихо сломается.

#### Решения, принятые самостоятельно (архитектурный документ их не задавал явно)

1. **`GetPublicTourCountsAsync` считает через `Where` + `Select` (оба есть в
   `IQueryableRepository<T>`), группировка — в памяти над уже сведённым в SQL
   списком `RegionId`.** В абстракции репозитория нет `GroupBy` — только
   `Where/Select/Join/GroupJoin` и терминальные методы. Прямой обход через
   `Context.Set<TourRegion>()` (реальный `DbQueryable`) тоже был бы возможен
   (`EntityBaseRepository.Entities` именно так и устроен внутри), но раз
   архитектурный документ сам сослался на `Select` в абстракции («отдельный
   репозиторий не нужен»), сделал через неё: `new
   EntityRepository<TourRegion>(Context).AsQueryable().Where(...).Select(tr
   => tr.RegionId).ToListAsync()`, затем `GroupBy` над `List<int>`. Группировка
   тривиальна (у `TourRegion` unique index `(TourId, RegionId)`, поэтому
   `Count()` на группу = число туров в регионе без риска задвоения).
2. **`TourValidationService` получил только один конструктор**
   (`entities, IApplicationDbContext context`), без второго (по
   `connectionString`), которым не пользуется ни один вызывающий (`internal`
   класс, оба вызова — из `TourCreationService`/`TourUpdateService`, у которых
   `Context` уже есть). Второй конструктор был бы мёртвым кодом.
3. **`TourInitializationService` проставляет `Regions = []`** — архитектурный
   документ явно этого не требовал (не входил в список изменяемых файлов для
   3.2), но без этого `InitTour` возвращал бы `Regions == null`, и если
   бы фронт отправил этот скелет как есть в `CreateTour`, `TourRegions`
   получился бы `null` при создании (не критично для `Create`, но
   несимметрично с `OrganizationalDetails`/`Restrictions`, которые уже
   инициализируются пустыми списками). Минимальное расширение по аналогии.
4. **Read-направление маппинга для `RegionTranslation` есть, write-направления
   (Create/Update) — нет.** CRUD регионов не входит в 3.2 (данные приходят
   сидом), поэтому `TranslatableCreateModel → RegionTranslation` не заводился —
   не хотел добавлять маппинг, которым ничто не пользуется.
5. **`GetToursAsyncClient`: параметр объявлен `string? region = null`, не
   `string region = null`.** `ATTours.ClientAPI` собирается с `<Nullable>
   enable</Nullable>`; без `?` компилятор даёт новый `CS8625`, которого не
   было в базовом прогоне (30 warnings) — с `?` предупреждение не
   появляется, набор предупреждений остался прежним.
6. **Сид-миграция сделана идемпотентной сверх минимума ADR 001**: и вставка
   регионов, и вставка переводов защищены `WHERE NOT EXISTS (...)` (по `Slug`
   для региона, по `Type + LanguageCode` для перевода), а не только
   «без хардкода Id», как буквально написано в ADR. Причина — «в разумных
   пределах идемпотентная» из задания; без guard'а повторный ручной прогон
   `Up()` уткнулся бы в unique index на `Slug` с ошибкой, а не молча
   продолжил. `Down()` остался простым `DELETE ... WHERE Slug IN (...)` —
   он и так идемпотентен (повторное удаление несуществующих строк — no-op).

#### Отступлений от архитектурного документа, требующих внимания

Отступлений в контрактах DTO/маршрутов/имён нет — всё реализовано буквально
по §3.2 архитектурного документа. Единственное расхождение — техническая
деталь реализации: `TourConfiguration.cs` **не тронут** (документ описывал
FK `TourRegion` целиком внутри `TourRegionConfiguration`, что и сделано;
это не расхождение, а явное следование документу, но фиксирую отдельно,
так как это отличается от того, как сегодня в проекте конфигурируется
`Tour → Restriction`/`Tour → OrganizationalDetail` — там `HasMany` стоит в
`TourConfiguration`, а не в дочерней конфигурации; для `TourRegion`
документ сознательно предписал другой паттерн из-за двух родителей).

#### Сверка сида с `Frontend/src/shared/data/armeniaRegions.ts`

Построчная сверка всех 11 записей (`slug` / `ru` / `en` / порядковый индекс в
массиве `REGIONS`) — **совпадение 11 из 11, расхождений нет**:

| # | Slug (файл) | Slug (миграция) | RU (файл) | RU (миграция) | EN (файл) | EN (миграция) |
| - | - | - | - | - | - | - |
| 0 | yerevan | yerevan | Ереван | Ереван | Yerevan | Yerevan |
| 1 | aragatsotn | aragatsotn | Арагацотн | Арагацотн | Aragatsotn | Aragatsotn |
| 2 | ararat | ararat | Арарат | Арарат | Ararat | Ararat |
| 3 | armavir | armavir | Армавир | Армавир | Armavir | Armavir |
| 4 | gegharkunik | gegharkunik | Гегаркуник | Гегаркуник | Gegharkunik | Gegharkunik |
| 5 | kotayk | kotayk | Котайк | Котайк | Kotayk | Kotayk |
| 6 | lori | lori | Лори | Лори | Lori | Lori |
| 7 | shirak | shirak | Ширак | Ширак | Shirak | Shirak |
| 8 | syunik | syunik | Сюник | Сюник | Syunik | Syunik |
| 9 | vayots-dzor | vayots-dzor | Вайоц-Дзор | Вайоц-Дзор | Vayots Dzor | Vayots Dzor |
| 10 | tavush | tavush | Тавуш | Тавуш | Tavush | Tavush |

`SortOrder` в миграции = индекс элемента в массиве `REGIONS` фронта (0..10),
как предписано. Поле `hy` и геометрия (`labelAt`, SVG-пути в
`regionGeometry.ts`) не переносились — замороженное решение.

#### Проверки

- **`dotnet build ATTours.slnx --no-incremental`** (после всех правок, включая
  файлы миграций): `Build succeeded. 30 Warning(s). 0 Error(s).` — набор
  предупреждений идентичен базовому (NU1903 + CS86xx/CS0168/CS8625* в
  предсуществующем коде — *единственный предсуществующий CS8625 в
  `TourInitializationController.cs:107` относится к `InitUpdate`, не к моему
  коду); ни одного нового предупреждения не введено (проверено построчным
  сравнением полного вывода до и после).
- **Миграции сгенерированы командой EF, в правильном порядке:**
  `ASPNETCORE_ENVIRONMENT=Development dotnet ef migrations add
  AddRegionAndTourRegion --project ATTours.DataLayer --startup-project
  ATTours.ClientAPI` → `Build succeeded. Done.` — создала
  `20260729182434_AddRegionAndTourRegion.cs`: 3 `CreateTable`
  (`Region`/`RegionTranslation`/`TourRegion`), `IX_Region_Slug unique: true`,
  `IX_TourRegion_TourId_RegionId unique: true`, FK `TourRegion→Region`
  `onDelete: Restrict`, FK `TourRegion→Tour` `onDelete: Cascade` — совпадает с
  архитектурным документом дословно. Затем `dotnet ef migrations add
  SeedArmenianRegions ...` → сгенерировала пустой `Up`/`Down` (модель не
  менялась), тело дописано вручную.
  `dotnet ef migrations list` подтвердил порядок:
  `...AddSiteSettings (Pending) → AddRegionAndTourRegion (Pending) →
  SeedArmenianRegions (Pending)`.
- **`dotnet ef database update` НЕ запускался** (по заданию). Замечание: при
  прогоне `migrations list` EF смог подключиться к БД (команда вернула
  реальный список из `__EFMigrationsHistory`, а не ошибку подключения) —
  то есть какая-то БД по строке подключения из `appsettings.Development.json`
  доступна, но накатывать миграции без явного «go» от Давида не стал.
- **Ручной прогон эндпоинтов через Swagger/.http НЕ делался.** Не проверено
  фактическое поведение: upsert/reconcile `TourRegions` в рантайме, поведение
  `AllowNullCollections` на реальном JSON без поля `regions` (описанный выше
  механизм null/[] логически выведен из кода AutoMapper/конфигурации, но не
  прогнан вживую), корректность `EXISTS`-подзапроса в фильтре `?region=` на
  реальных данных, поведение unique index `(TourId, RegionId)` при попытке
  добавить дубль. Это зона `backend-tester`.

#### Для 3.3 (следующий агент)

- `GlobalErrorCode` теперь занят до **2006**; следующий свободный — **2007**.
- `TourValidationService` больше не `EntityValidationBase<Tour>` — это
  `EntityValidationContextDependentBase<Tour, ATToursContextFactory>` с
  единственным конструктором `(List<Tour>, IApplicationDbContext)`. Если 3.3
  добавляет туда новые правила (например, про `TourNote`), не создавайте
  второй `TourValidationService` — расширяйте существующий, `Context` уже
  доступен как `protected`.
- `TourGraphQueryExtensions.IncludeTourGraph()` — новая последняя ветка перед
  правкой это `.Include(TourRegions).ThenInclude(Region)`; правки для
  `TourNote` дописывать после неё или на место
  `OrganizationalDetails`/`Restrictions`, которые вы будете убирать.
- `TourUpdateService` — `ReconcileCollection` для `TourRegions` обёрнут в
  `if (incoming.TourRegions is not null)`; это единственная коллекция графа
  тура с такой асимметрией — не копируйте этот паттерн на `Notes`, если явно
  не попросят (для `Notes` `null` должен трактоваться как обычно, т.е. как
  пустой список, раз контрактное правило null/[] специфично только для
  `Regions`, см. §3.2.9).
- `MappingProfile.cs`: секции `REGION`/`TOURREGION` и перевод
  `RegionTranslation → TranslatableInfoModel` добавлены перед секцией
  переводов `Restriction`/`OrganizationalDetail`, которые вы будете
  заменять на `TourNote`. Tour-блоки (`Tour → TourInfoModel`,
  `TourCreateModel/TourInfoModel → Tour`) теперь содержат строки про
  `Regions`/`TourRegions` вперемешку со строками про
  `OrganizationalDetails`/`Restrictions` — при замене последних на `Notes`
  не заденьте регионные строки.
- `Tour.cs` теперь содержит оба новых и старых полей
  (`OrganizationalDetails`, `Restrictions`, `TourRegions`) — при слиянии в
  `Notes` трогайте только первые два.
- Порядок миграций: `AddSiteSettings → AddRegionAndTourRegion →
  SeedArmenianRegions → MergeRestrictionAndOrganizationalDetailIntoTourNote`.
  Ваша миграция должна генерироваться поверх `20260729182454_SeedArmenianRegions`.

---

### 2026-07-29 — backend-developer, 3.3 TourNote (реализовано)

Реализован **только** пункт 3.3. `SiteSetting*`, `Region*`, `TourRegion*` не тронуты.
Клиентские фильтры 3.0 (`GetToursAsyncClient` → `IsActive && !IsArchived`,
not-found-фильтр в `GetTourInfo`) и контрактное правило `Regions == null`/`[]`
не тронуты — проверено чтением файлов после правок. **Фронтенд не тронут ни одним
файлом**; три файла админки только читались, чтобы составить инструкцию ниже.

#### Созданные файлы

`ATTours.Common`
- `Enums/TourNoteType.cs` — `OrganizationalDetail = 1, Restriction = 2`.
- `Entities/TourNote.cs` — `TourId`, `Type`, `SortOrder`, `Tour`,
  `HashSet<TourNoteTranslation> Translations`.
- `Entities/TourNoteTranslation.cs` — `TourNoteId`, `LanguageCode`, `Value`, nav.
  Своего `Type` у перевода нет (как было у `RestrictionTranslation`).
- `Infrastructure/EntityConfiguration/TourNoteConfiguration.cs` — `ToTable`,
  `HasMany(Translations)` → Cascade, `HasIndex(new { TourId, Type })`.
- `Infrastructure/EntityConfiguration/TourNoteTranslationConfiguration.cs` —
  `Value` required 4000.
- `DTO/Info/TourNoteInfoModel.cs` — `{ Id, TourNoteType Type, SortOrder, Translations }`.
- `DTO/Init/TourNoteCreateModel.cs` — `{ TourNoteType Type, SortOrder, Translations }`,
  namespace `ATTours.Common.Dto.Init` (строчное `Dto`, как у соседей).

`ATTours.DataLayer`
- `Migrations/20260729183450_MergeRestrictionAndOrganizationalDetailIntoTourNote.cs`
  (+ `.Designer.cs`, обновлён `ATToursContextModelSnapshot.cs`).

#### Удалённые файлы (12)

`Entities/`: `Restriction.cs`, `RestrictionTranslation.cs`, `OrganizationalDetail.cs`,
`OrganizationalDetailTranslation.cs`.
`Infrastructure/EntityConfiguration/`: `RestrictionConfiguration.cs`,
`RestrictionTranslationConfiguration.cs`, `OrganizationalDetailConfiguration.cs`,
`OrganizationalDetailTranslationConfiguration.cs`.
`DTO/Info/`: `RestrictionInfoModel.cs`, `OrganizationalDetailInfoModel.cs`.
`DTO/Init/`: `RestrictionCreateModel.cs`, `OrganizationalDetailCreateModel.cs`.

Удалены **после** того, как миграция переноса данных была написана, а не до.

#### Изменённые файлы

- `Entities/Tour.cs` — `OrganizationalDetails` + `Restrictions` → `HashSet<TourNote> Notes = []`.
  `TourRegions` не тронут.
- `Infrastructure/EntityConfiguration/TourConfiguration.cs` — два `HasMany` → один
  (`Notes`, Cascade).
- `DTO/Info/TourInfoModel.cs`, `DTO/Init/TourCreateModel.cs` — два списка → `Notes`.
- `Extensions/LanguageExtensions.cs` — два цикла → один по `tour.Notes`.
- `ATTours.DataLayer/ATToursContext.cs` — 4 `DbSet` → 2 (`TourNotes`, `TourNoteTranslations`).
- `Services/InfoServices/TourGraphQueryExtensions.cs` — два `Include` → один
  `Include((Expression<Func<Tour, ICollection<TourNote>>>)(x => x.Notes)).ThenInclude(n => n.Translations)`.
- `Services/UpdateServices/TourUpdateService.cs` — два `ReconcileCollection` → один;
  в него добавлен перенос `target.Type = src.Type` (заметку можно перетащить из орг.
  деталей в ограничения, не пересоздавая её).
- `Services/InitServices/TourInitializationService.cs` — `Notes = new List<TourNoteCreateModel>()`.
- `ClientAPI/Mapper/MappingProfile.cs` — см. ниже.

`TourDeletionService`, `TourValidationService`, `TourCreationService`, контроллеры —
**без изменений**. Новых кодов ошибок нет: `GlobalErrorCode` по-прежнему занят до 2006.

#### Маппинг: было 12 `CreateMap`, стало 6

Архитектурный документ говорит «~8 блоков → 5». Фактически в коде было **12**
`CreateMap` (по 3 на каждую из двух сущностей + по 3 на каждую из двух таблиц
переводов), стало **6** — ровно те, что перечислены в §3.3.4 поимённо
(последние два пункта списка документа посчитаны там за один). Раскладка своя не
изобреталась, расхождение только в арифметике заголовка.

Оставшиеся 6: `TourNote → TourNoteInfoModel`, `TourNoteCreateModel → TourNote`,
`TourNoteInfoModel → TourNote`, `TranslatableCreateModel → TourNoteTranslation`,
`TranslatableInfoModel → TourNoteTranslation`, `TourNoteTranslation → TranslatableInfoModel`
(`Type` → константа 0, вид заметки едет отдельным полем `TourNoteInfoModel.Type`).

В `Tour → TourInfoModel`: `Notes` мапится как
`src.Notes.OrderBy(n => n.Type).ThenBy(n => n.SortOrder)`. Строки про
`Regions`/`TourRegions` не задеты.

#### Сортировка внутри типа — где именно это обеспечено

- **Чтение:** единственная сортировка заметок в кодовой базе — `OrderBy(Type).ThenBy(SortOrder)`
  в `MappingProfile`. Сквозного `OrderBy(SortOrder)` по всем заметкам тура нет нигде
  (проверено грепом по `Notes` во всех проектах).
- **Запись:** `TourUpdateService` копирует `SortOrder` как есть и не перенумеровывает;
  серверной глобальной нумерации не появилось.
- **Миграция:** `SortOrder` переливается вербатим, отдельным `INSERT` на каждый тип.
  Никакого `ROW_NUMBER()`/пересчёта — два диапазона `0..n-1` на тур остаются
  независимыми.
- **Индекс:** `IX_TourNote_TourId_Type` `(TourId, Type)`. Отдельный `IX_TourNote_TourId`
  EF не создал — составной индекс покрывает FK первой колонкой.

#### Миграция: что пришлось править руками и почему

Сгенерирована командой:
`ASPNETCORE_ENVIRONMENT=Development dotnet ef migrations add
MergeRestrictionAndOrganizationalDetailIntoTourNote --project ATTours.DataLayer
--startup-project ATTours.ClientAPI` →
`Build succeeded. An operation was scaffolded that may result in the loss of data.
Please review the migration for accuracy. Done.`

Скаффолдер подтвердил опасение ADR 003 буквально: сгенерированный `Up()` начинался с
**четырёх `DropTable` ПЕРЕД `CreateTable`** — в таком виде миграция уничтожила бы все
орг. детали и ограничения. Тело переписано вручную внутри сгенерированного файла:

1. `CreateTable TourNote` (+ временные `LegacyId int NULL`, `LegacySource tinyint NULL`)
   и `TourNoteTranslation`, оба индекса.
2. `INSERT INTO TourNote ... SELECT TourId, 1, SortOrder, Id, 1 FROM OrganizationalDetail`;
   то же из `Restriction` с `Type = 2`, `LegacySource = 2`.
3. Переводы — `INNER JOIN` старой таблицы переводов с `TourNote` по паре
   `(LegacySource, LegacyId)`.
4. `DropColumn LegacyId`, `DropColumn LegacySource`.
5. `DropTable` четырёх старых таблиц (переводы раньше родителей).

**Отступление от буквы ADR 003:** временные колонки объявлены прямо в `CreateTable`,
а не отдельным `AddColumn`. Причина техническая и проверена на реальном выводе
`dotnet ef migrations script`: EF укладывает всю миграцию в **один батч**
(`BEGIN TRANSACTION` … `COMMIT` … один `GO`), а SQL Server не даёт сослаться на
колонку, добавленную через `ALTER TABLE ADD` в том же батче («Invalid column name»).
Для только что созданной таблицы работает deferred name resolution, поэтому вариант
с `CreateTable` корректен и при `database update` (покомандно), и при прогоне
сгенерированного скрипта целиком. Первая версия (с `AddColumn`) была бы рабочей
только через `database update` — это скрытая мина, поэтому переделано.

#### Что теряется при откате (`Down`)

`Down()` реализован полноценно и переносит данные обратно: создаёт четыре старые
таблицы (у `OrganizationalDetail`/`Restriction` — временная `LegacyNoteId`),
раскладывает заметки по `Type` (1 → `OrganizationalDetail`, 2 → `Restriction`),
переливает переводы `JOIN`-ом по `LegacyNoteId`, дропает временные колонки и обе
новые таблицы. Переносятся один в один: `TourId`, `SortOrder` (внутри своего типа),
`LanguageCode`, `Value`, принадлежность перевода заметке.

**НЕ восстанавливается (честный список, а не формальность):**
1. **`Id` заметок и `Id` переводов.** Обе стороны получают новые identity-значения.
   Следствие: открытая в момент отката форма тура в админке отправит устаревшие `id`
   и получит 400 `InvalidEntityIds`. Откат безопасен только до первого сохранения
   тура на новой схеме.
2. **Заметки с `Type`, отличным от 1 и 2.** Через API появиться не могут (enum
   закрыт), возможны только при ручной правке БД. В старую схему не раскладываются
   и будут потеряны вместе со своими переводами.

Ничего другого не теряется. Тестировать слияние всё равно следует на копии БД.

#### ЛОМАЕТ КОНТРАКТ API — точный diff (решение D-3)

Затронуты `POST CreateTour` (запрос), `PUT UpdateTour` (запрос и ответ),
`GET InitTour` (ответ), `GET InitUpdate` (ответ), `GET GetAll` / `GET GetArchived` /
`GET GetTours` / `GET GetTourInfo` (ответ) — везде, где фигурирует тур целиком.

**Удалены из `TourCreateModel` (запрос `CreateTour`, ответ `InitTour`):**

```
- "organizationalDetails": [ { "sortOrder": 0, "translations": [...] } ]
- "restrictions":          [ { "sortOrder": 0, "translations": [...] } ]
```

**Удалены из `TourInfoModel` (запрос/ответ `UpdateTour`, все ответы чтения):**

```
- "organizationalDetails": [ { "id": 0, "sortOrder": 0, "translations": [...] } ]
- "restrictions":          [ { "id": 0, "sortOrder": 0, "translations": [...] } ]
```

**Добавлено вместо них — один список в обеих моделях:**

```
+ "notes": [ { "id": 0, "type": 1, "sortOrder": 0, "translations": [...] } ]   // TourInfoModel
+ "notes": [ {           "type": 1, "sortOrder": 0, "translations": [...] } ]   // TourCreateModel
```

- `type`: `1` = бывшие `organizationalDetails`, `2` = бывшие `restrictions`. Едет
  **числом**, как все enum проекта.
- `sortOrder`: как и раньше, индекс внутри СВОЕГО вида. У тура два независимых
  диапазона `0..n-1`; `[{type:1,sortOrder:0},{type:2,sortOrder:0}]` — валидно и
  нормально.
- `translations[].type` у заметки по-прежнему `0` (одно текстовое поле) — не путать
  с новым `type` самой заметки.
- Порядок в ответе: сначала все `type: 1` по `sortOrder`, затем все `type: 2` по
  `sortOrder`. Полагаться на порядок не обязательно — `type` есть в каждом элементе.
- `InitTour` теперь возвращает `"notes": []` вместо двух пустых массивов.

Публичный сайт не затронут (он на моках `shared/api/tours.ts`).

#### ГОТОВАЯ ИНСТРУКЦИЯ ФРОНТЕНД-АГЕНТУ (админка, 3 файла)

Проверено чтением фактического кода фронта на 29.07.2026. **UI и вью-модель формы
не меняются**: поля `organizationalDetails`/`restrictions` в `TourFormState`
остаются, `types/form.ts`, `tourFormReducer.ts`, `useTourForm.ts`, `TourForm.tsx`,
`LocalizedListEditor.tsx`, `RepeaterControls.tsx` не трогать.

**1. `Frontend/src/features/admin/lib/enums.ts`** — добавить (стиль файла: frozen
const object + производный union-тип, TS `enum` запрещён из-за `erasableSyntaxOnly`):

```ts
/** Вид заметки тура. Один список `notes` вместо двух — бэк различает их по `type`. */
export const TourNoteType = {
  OrganizationalDetail: 1,
  Restriction: 2,
} as const

export type TourNoteType = (typeof TourNoteType)[keyof typeof TourNoteType]
```

Комментарий на строках 41-42 (`Note: 'Detail' and 'Restriction' are no longer
translation types … (organizationalDetails / restrictions on the tour)`) стоит
поправить — теперь это один список `notes` с полем `type`.

**2. `Frontend/src/shared/types/attours.ts`** — удалить 4 интерфейса и заменить их
двумя:
- удалить `OrganizationalDetailCreateModel` (строки 48-53, вместе с ведущим
  doc-комментарием), `RestrictionCreateModel` (55-58),
  `OrganizationalDetailInfoModel` (113-117), `RestrictionInfoModel` (119-123);
- добавить:

```ts
/** Упорядоченное двуязычное поле тура. `translations[].type` всегда 0 (одно текстовое
 * поле). Вид заметки задаёт `type`; `sortOrder` считается ВНУТРИ своего вида, поэтому
 * у тура два независимых диапазона 0..n-1. */
export interface TourNoteCreateModel {
  type: number
  sortOrder: number
  translations: TranslatableCreateModel[]
}

export interface TourNoteInfoModel {
  id: number
  type: number
  sortOrder: number
  translations: TranslatableInfoModel[]
}
```

- в `TourCreateModel` (строки 67-68): две строки
  `organizationalDetails: …` / `restrictions: …` → одна `notes: TourNoteCreateModel[]`;
- в `TourInfoModel` (строки 140-141): то же → `notes: TourNoteInfoModel[]`.

Поле `regions` в этих интерфейсах на фронте пока отсутствует — так и есть, это
пункт 4.4, в 3.3 его не добавлять.

**3. `Frontend/src/features/admin/lib/tourMapper.ts`** — 4 места (в архитектурном
документе указано «8 мест ~115-119, 142-147, 256-260, 329-334» — это 4 блока по
2 списка; фактические строки на момент правки те же). Импортировать `TourNoteType`
из `@/features/admin/lib/enums`.

- **Чтение, `createModelToForm` (строки 115-122)** — `dto.organizationalDetails` /
  `dto.restrictions` больше нет, оба списка вью-модели собираются из одного `notes`
  фильтром по `type`:

```ts
organizationalDetails: (dto.notes ?? [])
  .filter((n) => n.type === TourNoteType.OrganizationalDetail)
  .map((n) => ({ key: newKey(), text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description) })),
restrictions: (dto.notes ?? [])
  .filter((n) => n.type === TourNoteType.Restriction)
  .map((n) => ({ key: newKey(), text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description) })),
```

- **Чтение, `infoToForm` (строки 142-151)** — то же самое, но `sortBySortOrder`
  применяется **после** фильтра по `type` (сортировать общий список нельзя:
  `sortOrder` уникален только внутри вида) и сохраняется `serverId: n.id`:

```ts
organizationalDetails: sortBySortOrder(
  (dto.notes ?? []).filter((n) => n.type === TourNoteType.OrganizationalDetail),
).map((n) => ({ key: newKey(), serverId: n.id, text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description) })),
restrictions: sortBySortOrder(
  (dto.notes ?? []).filter((n) => n.type === TourNoteType.Restriction),
).map((n) => ({ key: newKey(), serverId: n.id, text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description) })),
```

- **Запись, `formToCreateModel` (строки 256-263)** — два поля payload'а
  схлопываются в одно; `sortOrder` по-прежнему индекс внутри своего массива:

```ts
notes: [
  ...form.organizationalDetails.map((o, i) => ({
    type: TourNoteType.OrganizationalDetail,
    sortOrder: i,
    translations: writeLocalized(ExpenseTranslationType.Description, o.text),
  })),
  ...form.restrictions.map((o, i) => ({
    type: TourNoteType.Restriction,
    sortOrder: i,
    translations: writeLocalized(ExpenseTranslationType.Description, o.text),
  })),
],
```

- **Запись, `formToUpdateModel` (строки 329-338)** — то же плюс `id: o.serverId ?? NEW`
  и `asInfoTranslations(...)`:

```ts
notes: [
  ...form.organizationalDetails.map((o, i) => ({
    id: o.serverId ?? NEW,
    type: TourNoteType.OrganizationalDetail,
    sortOrder: i,
    translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
  })),
  ...form.restrictions.map((o, i) => ({
    id: o.serverId ?? NEW,
    type: TourNoteType.Restriction,
    sortOrder: i,
    translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
  })),
],
```

Важно для reconcile-по-id на бэке: `id` заметки после слияния **другой** (все `Id`
переназначены миграцией). Форму тура, открытую до наката миграции, нужно
перезагрузить, иначе `UpdateTour` вернёт 400 `InvalidEntityIds`.

Комментарии-шапки в `tourMapper.ts` (строки 42-43, «Route points, organizational
details and restrictions all share the LocalizedListItem shape») и алиасы
`emptyOrganizationalDetail` / `emptyRestriction` менять не обязательно — они про
вью-модель, а она не меняется.

#### Проверки

- **Базовый прогон до правок:** `dotnet build ATTours.slnx --no-incremental` →
  `Build succeeded. 30 Warning(s). 0 Error(s).`
- **После правок кода (до генерации миграции):** то же —
  `Build succeeded. 30 Warning(s). 0 Error(s).`
- **После рукописного тела миграции (первая версия, с `AddColumn`):** то же —
  `Build succeeded. 30 Warning(s). 0 Error(s).`
- **Финальный прогон (версия с временными колонками в `CreateTable`):**
  `Build succeeded. 30 Warning(s). 0 Error(s)` — набор идентичен базовому
  (NU1903 + CS86xx/CS0168 в предсуществующем коде), ни одного предупреждения в
  новых файлах. Оговорка: этот последний прогон пришлось делать с
  `--artifacts-path` во временный каталог, потому что обычная сборка упала на
  `MSB3027/MSB3021` — dll'ки в `ATTours.ClientAPI/bin` держал **запущенный дев-сервер**
  `ATTours.ClientAPI.exe --urls http://localhost:5254` (PID 17952, старт 22:38).
  Это не ошибка компиляции; чужой процесс я не убивал. Компилировался тот же
  `ATTours.slnx` тем же `--no-incremental`, отличается только каталог вывода.
- **Миграция сгенерирована командой EF**, тело переноса дописано руками внутри
  сгенерированного файла (см. выше дословный вывод команды).
- **`dotnet ef migrations list`** — порядок подтверждён, все четыре миграции этапа 3
  идут одна за другой и все `Pending`:
  ```
  20260729181120_AddSiteSettings (Pending)
  20260729182434_AddRegionAndTourRegion (Pending)
  20260729182454_SeedArmenianRegions (Pending)
  20260729183450_MergeRestrictionAndOrganizationalDetailIntoTourNote (Pending)
  ```
- **`dotnet ef database update` НЕ запускался** (накат — отдельное решение Давида).
  Замечание: `migrations list` реально подключился к БД и прочитал
  `__EFMigrationsHistory`, то есть БД доступна.
- **Сгенерирован и вычитан глазами SQL обеих сторон** (`dotnet ef migrations script`
  вперёд и назад, файлы во временный каталог, к БД не применялись).

#### Результат построчной проверки SQL переноса

1. **Переводы не теряются.** Обе таблицы переводов имеют `NOT NULL` FK на родителя,
   а каждая строка родителя даёт ровно одну строку `TourNote` (`INSERT … SELECT` без
   `WHERE`). Значит `INNER JOIN` по `(LegacySource, LegacyId)` возвращает ровно одну
   пару на каждый исходный перевод: ни потерь, ни задвоения. RU и EN переливаются
   одинаково — `LanguageCode` и `Value` копируются вербатим.
2. **`LegacySource` — не украшение.** `OrganizationalDetail.Id = 5` и
   `Restriction.Id = 5` существуют одновременно. Если бы джойн шёл только по
   `LegacyId`, каждый перевод прицепился бы к обеим заметкам — и задвоение, и
   перепутанные тексты. Пара `(LegacySource, LegacyId)` это исключает.
3. **`SortOrder` двух типов не схлопывается в один диапазон.** Два отдельных
   `INSERT`, `SortOrder` копируется как есть, ни `ROW_NUMBER()`, ни `+ offset`,
   ни `ORDER BY` по объединению. Тур с 3 орг. деталями (0,1,2) и 2 ограничениями
   (0,1) получает 5 заметок: `(1,0) (1,1) (1,2) (2,0) (2,1)`.
4. **FK корректны.** `FK_TourNote_Tour_TourId` → `Tour(Id)` `ON DELETE CASCADE`
   (как было у обеих старых таблиц, поэтому `TourDeletionService` не меняется);
   `FK_TourNoteTranslation_TourNote_TourNoteId` → `TourNote(Id)` `ON DELETE CASCADE`.
   `TourId` переливается из старой строки, поэтому ни одна заметка не может
   осиротеть или уехать к чужому туру.
5. **Порядок операций безопасен.** Старые таблицы дропаются последними, уже после
   того как данные переписаны и временные колонки удалены. Вся миграция — одна
   транзакция (`BEGIN TRANSACTION` … `COMMIT` в сгенерированном скрипте), поэтому
   падение на любом шаге откатывает всё, а не оставляет полусостояние.
6. **`Down` симметричен** и проверен тем же способом; список того, что он не
   восстанавливает — выше, отдельным разделом.

Что **не** проверено (зона `backend-tester`): ручной прогон через Swagger/.http,
фактическое поведение reconcile `Notes` в рантайме, валидность конфигурации
AutoMapper при старте, и главное — **прогон самой миграции на копии БД с реальными
данными**. SQL вычитан глазами и сгенерирован EF, но ни разу не выполнен.

#### Для следующих агентов (3.4+)

- `GlobalErrorCode` по-прежнему занят до **2006**, следующий свободный — **2007**.
- Последняя миграция в цепочке —
  `20260729183450_MergeRestrictionAndOrganizationalDetailIntoTourNote`.
- Планируемый в 3.4 `TourNoteTemplate` ложится на `TourNote` естественно: nullable FK
  на шаблон + `Type` уже есть.
- **Мелкий долг, оставленный сознательно:** комментарии в
  `ATTours.Common/Entities/RegionTranslation.cs:12` и
  `ATTours.Common/Entities/SiteSettingTranslation.cs:9` ссылаются на
  `RestrictionTranslation` — класс, которого больше нет. Не поправил, потому что
  задание прямо запрещало трогать `SiteSetting*`/`Region*`. Правка чисто
  косметическая: `RestrictionTranslation` → `TourNoteTranslation`.

---

### 2026-07-29 — frontend-developer, 3.3 — админка под `notes`

Реализовано **ровно по инструкции backend-developer** (раздел выше, «ГОТОВАЯ ИНСТРУКЦИЯ
ФРОНТЕНД-АГЕНТУ»). Прочитан фактический код всех трёх файлов до правки — инструкция
совпала с реальным кодом дословно (номера строк, содержимое), расхождений документа с
кодом не найдено. Правились строго 3 файла, ничего больше.

#### Что изменено

**`Frontend/src/features/admin/lib/enums.ts`**
- Добавлен `TourNoteType` (`OrganizationalDetail = 1, Restriction = 2`) тем же паттерном
  frozen-const-object + производный union-тип, что и у остальных enum файла.
- Поправлен комментарий у `TourTranslationType` (строки 40-42): вместо «стали отдельными
  сущностями» теперь явно сказано, что бэк слил их в один список `notes`, различаемый
  `TourNoteType`, а форма админки по-прежнему показывает два раздела.

**`Frontend/src/shared/types/attours.ts`**
- Удалены `OrganizationalDetailCreateModel`, `RestrictionCreateModel`,
  `OrganizationalDetailInfoModel`, `RestrictionInfoModel`.
- Добавлены `TourNoteCreateModel { type, sortOrder, translations }` и
  `TourNoteInfoModel { id, type, sortOrder, translations }` с doc-комментарием про
  независимые диапазоны `sortOrder` внутри каждого `type`.
- `TourCreateModel.organizationalDetails/restrictions` → `TourCreateModel.notes: TourNoteCreateModel[]`.
- `TourInfoModel.organizationalDetails/restrictions` → `TourInfoModel.notes: TourNoteInfoModel[]`.
- Поле `regions` не добавлялось — вне скоупа 3.3 (это 4.4), как и было указано в инструкции.

**`Frontend/src/features/admin/lib/tourMapper.ts`**
- Импорт `TourNoteType` из `@/features/admin/lib/enums`.
- `createModelToForm`: `organizationalDetails`/`restrictions` вью-модели теперь строятся
  фильтром `(dto.notes ?? []).filter(n => n.type === TourNoteType.X)` вместо чтения
  `dto.organizationalDetails`/`dto.restrictions`.
- `infoToForm`: то же самое, но `sortBySortOrder` применяется **после** фильтра по `type`
  (сортировать общий список нельзя — `sortOrder` уникален только внутри вида), `serverId: n.id`
  сохраняется как и раньше.
- `formToCreateModel`: два поля payload'а (`organizationalDetails`, `restrictions`) схлопнуты
  в одно поле `notes: [...]` — конкатенация двух `map()`, `sortOrder` по-прежнему индекс
  внутри своего исходного массива (`form.organizationalDetails`/`form.restrictions` по
  отдельности), поэтому диапазоны `0..n-1` остаются независимыми, а не сквозными.
- `formToUpdateModel`: аналогично, плюс `id: o.serverId ?? NEW` на каждый элемент.
- Комментарии-шапки (строка 42-43, `emptyOrganizationalDetail`/`emptyRestriction` алиасы) и
  вью-модель (`TourFormState.organizationalDetails/restrictions`) не тронуты — по заданию.

UI-компоненты (`TourForm.tsx`, `LocalizedListEditor.tsx`, `RepeaterControls.tsx`), редьюсер
формы (`tourFormReducer.ts`), `useTourForm.ts`, `types/form.ts` — **не открывались на
редактирование**, только читались через грep для итоговой проверки.

#### Решения, принятые самостоятельно

Ни одного — инструкция была буквальной и полной (код + номера строк совпали с реальным
файлом), отклоняться было не от чего. Сортировка `notes` при склейке двух списков (что было
явно подчёркнуто в задании) реализована так же, как задокументировал backend-developer:
`sortOrder` в каждой из двух веток `notes.map()` — это индекс внутри `form.organizationalDetails`/
`form.restrictions` соответственно, а не сквозной индекс объединённого массива.

#### Расхождения инструкции с реальным кодом

Не найдено. Три файла до правки читались построчно и совпали с блоками кода, приведёнными
в разделе «ГОТОВАЯ ИНСТРУКЦИЯ ФРОНТЕНД-АГЕНТУ» дословно.

#### Проверки (реальные результаты)

- **`npx tsc -b`** (skeleton `tsconfig.json` со ссылками `app`/`node` проектов, тот же
  скрипт, что вызывает `npm run build`): пустой вывод, код завершения успешный — 0 ошибок.
- **`npm run build`** (`tsc -b && vite build`): успешно, `Build succeeded` эквивалент —
  `✓ 573 modules transformed`, `✓ built in 578ms`, без единого warning в выводе vite/tsc.
  Базовый прогон до правки не снимался отдельно (задача пришла с уже применёнными правками
  в рабочей копии), но и после правки предупреждений в выводе сборки нет вовсе — 0.
- **`npx oxlint`**: 16 warning — все pre-existing, ни один не в трёх изменённых файлах
  (`enums.ts`, `attours.ts`, `tourMapper.ts` в списке warning отсутствуют); все 16 —
  `react(only-export-components)` и `react-hooks(exhaustive-deps)` в файлах, к 3.3 не
  относящихся (`Sheet.tsx`, `Popover.tsx`, `DatePicker.tsx`, `Select.tsx`,
  `DashboardPage.tsx` и т.п.).
- **Греп по `Frontend/src` на `organizationalDetails|restrictions`**: все оставшиеся
  вхождения — вью-модель формы (`types/form.ts`, `tourFormReducer.ts`, `useTourForm.ts`,
  `TourForm.tsx`, `LocalizedListEditor.tsx`, `RepeaterControls.tsx`) и локальные имена в
  `tourMapper.ts`, ссылающиеся на `form.organizationalDetails`/`form.restrictions` (поля
  вью-модели, не wire). Обращений к `dto.organizationalDetails`/`dto.restrictions` как к
  полям wire-контракта не осталось — ни одного. Отдельно проверено грепом по именам
  типов `OrganizationalDetailCreateModel|RestrictionCreateModel|OrganizationalDetailInfoModel|RestrictionInfoModel`
  — 0 совпадений во всём `src`.
- **Живой прогон в браузере НЕ делался** — по заданию, зона главного агента.

#### Для следующих агентов

- Три файла (`shared/types/attours.ts`, `features/admin/lib/tourMapper.ts`,
  `features/admin/lib/enums.ts`) теперь синхронны с бэкенд-контрактом `notes`/`TourNoteType`.
  Вью-модель формы (`TourFormState.organizationalDetails/restrictions`) осознанно осталась
  прежней — слияние живёт только в мапере.
- Публичный сайт (`shared/api/tours.ts` и моки) не тронут и не проверялся на этот контракт —
  вне скоупа, как и было сказано в задании.
- Напоминание из инструкции backend-developer остаётся в силе: форма тура, открытая в
  браузере **до** наката миграции `MergeRestrictionAndOrganizationalDetailIntoTourNote`,
  после наката отправит устаревшие `id` заметок и получит 400 `InvalidEntityIds` — нужно
  перезагрузить страницу формы после миграции.

---

### 2026-07-29 — 3.6 ЗАБЛОКИРОВАН: нет доступа к LocalDB из сессии агента

Давид разрешил накат миграций по схеме «сначала бэкап, потом накат».
**Накат не выполнен — до бэкапа дело не дошло, БД недостижима из окружения,
в котором работает агент.** Это не отговорка и не «не пробовал»: ниже
фактические результаты.

**Что установлено (реальные команды, не предположения):**
- Строка подключения — `Server=(LocalDB)\MSSQLLocalDB;Database=ATTours;
  Trusted_Connection=True` (`appsettings.Development.json`).
- `sqlcmd -S "(LocalDB)\MSSQLLocalDB"` → login timeout, «сервер не найден».
- `sqllocaldb info MSSQLLocalDB` → `State: Stopped`, `Instance pipe name:` пусто.
- `sqllocaldb start MSSQLLocalDB` → `Error occurred during LocalDB instance
  startup: SQL Server process failed to start.` Повтор с отключённым
  sandbox — та же ошибка, значит дело НЕ в песочнице инструмента.
- `dotnet ef migrations list` → тот же `error: 50 - Local Database Runtime
  error occurred… SQL Server process failed to start`. Список миграций выдан
  из файлов проекта, но колонка Pending не определена — то есть EF тоже
  не подключился.
- При этом процесс `sqlservr` **PID 9688 живой** (старт 22:42:22), и
  `error.log` инстанса показывает успешные `Starting up database 'ATTours'`
  в 22:42, 22:49 и 22:52 — то есть инстанс работает и кто-то в него ходит.
  Одновременно живёт `ATTours.ClientAPI` PID 20808 (старт 22:53:15) —
  дев-сервер бэкенда, поднятый вне сессии агента.

**Вывод (гипотеза, не факт):** инстанс LocalDB принадлежит интерактивной
сессии Давида и обслуживает запущенный дев-сервер. Сессия агента —
не интерактивная, LocalDB Runtime в ней пытается поднять СВОЙ экземпляр
поверх уже занятых файлов и падает. Отсюда «Stopped» в `info` при живом
`sqlservr`. Проверить гипотезу до конца из сессии агента нечем.

**Следствие для статуса этапа 3:** все четыре миграции
(`AddSiteSettings` → `AddRegionAndTourRegion` → `SeedArmenianRegions` →
`MergeRestrictionAndOrganizationalDetailIntoTourNote`) существуют в коде,
проект собирается (0 Errors, 30 Warnings — набор базовый), но **ни одна
из них ни разу не выполнялась ни на какой БД**. SQL миграции слияния
вычитан построчно, но не исполнен. Пункт 3.6 остаётся открытым.

**Что должен сделать Давид в СВОЁМ терминале** (порядок обязателен):
1. Остановить дев-сервер бэкенда (`ATTours.ClientAPI`), иначе он держит
   старые DLL и открытое соединение.
2. Бэкап:
   `sqlcmd -S "(LocalDB)\MSSQLLocalDB" -Q "BACKUP DATABASE ATTours TO DISK='D:\Davo\Claude AI Agent\Hay Travel\Backend\_db-backup\ATTours-2026-07-29.bak' WITH INIT"`
   (папку `_db-backup` создать заранее; в git её класть не нужно).
3. Накат: `dotnet ef database update --project ATTours.DataLayer --startup-project ATTours.ClientAPI`
   из `Hay Travel\Backend`, при `ASPNETCORE_ENVIRONMENT=Development`.
4. Прислать вывод — сверку «данные переехали 1:1» и ручной прогон API
   делает `backend-tester` в следующей сессии.

**Проверка кода этапа 3 (`backend-tester` + `backend-code-reviewer`)
намеренно НЕ запускалась** — Давид перенёс её на следующую сессию.

<!-- Дальше дописывают субагенты -->

### 2026-07-30 — backend-architect, решение по 3.4 (Справочники + override)

Решение, реализацию делает `backend-developer`. Замороженные решения по справочникам
(«ссылка на каталог + per-tour override», RU/EN, контроллеры без DI с конструктором
`IApplicationDbContext`, регион у точки только через каталог `Place`) не переигрывались.
Спорное вынесено в развилки **D-5…D-8** — решает Давид, сам не принимаю.

Опорные паттерны — `Region` (3.2, каталог со `Slug`+`SortOrder`+переводы) и `TourNote`
(3.3, `Type`+`SortOrder`+переводы без своего `Type` у перевода). 3.4 их не изобретает
заново, а надстраивает механикой override.

#### 3.4.0 Что вводится (сводка)

Три каталога-справочника + nullable-FK «ссылка на каталог» у трёх существующих
tour-level сущностей + разрешение «override ?? template» в слое Service.

| Каталог | Идентичность | Что несёт | Кто на него ссылается (nullable FK) |
| --- | --- | --- | --- |
| `Place` | `Slug` (unique) | регион (FK), координаты, фото, имя (перевод) | `RoutePoint.PlaceId` (точка дня) |
| `ExpenseTemplate` | `Id` | `SortOrder`, описание (перевод) | `AdditionalExpense.ExpenseTemplateId` (расход тура) |
| `TourNoteTemplate` | `Id` | `TourNoteType Type`, `SortOrder`, текст (перевод) | `TourNote.TourNoteTemplateId` (заметка тура) |

`Place` получает `Slug` (внешне-адресуемый географический объект, как `Region` — стабильный
ключ, дедуп-гард, потенциальная ссылка с карты). `ExpenseTemplate`/`TourNoteTemplate`
слага **не имеют** — они внутренние переиспользуемые шаблоны текста, адресуются по `Id`,
как `RegionId` в `TourRegion`. Осознанное различие, не забывчивость.

#### 3.4.1 Ключевая механика override («override ?? template»)

**Модель (рекомендация D-5, ждёт решения Давида):** у tour-level сущности —
**nullable FK на шаблон + её же существующая коллекция `Translations` в роли override-строк**.
Отдельного флага `IsOverridden` и снапшот-копии нет.

Разрешение эффективного значения (в слое **Service**, по языку — как `SiteSettings.ResolveValue`
из 3.1):

```
effective(lang) = own.Translations.FirstOrDefault(t => t.LanguageCode == lang)?.Value
               ?? template?.Translations.FirstOrDefault(t => t.LanguageCode == lang)?.Value
```

Состояния tour-level строки:
- **FK == null** → свободная запись (текущее поведение до 3.4). Источник текста — только
  собственные переводы. Обратная совместимость: все существующие `RoutePoint`/
  `AdditionalExpense`/`TourNote` живут именно так после миграции.
- **FK != null, нет своей строки перевода на язык** → «привязано, не переопределено».
  Значение берётся из шаблона. Правка шаблона в каталоге меняет ВСЕ такие туры — это и есть
  замороженное «правка каталога меняет все, кроме переопределённых».
- **FK != null, есть своя строка перевода на язык** → «переопределено вручную». Значение
  берётся своё, каталог на него больше не влияет.

Следствия, которые надо знать:
- **Override гранулярен по языку** (наличие own-строки на данный `LanguageCode`), а не по
  всей записи целиком. Это ровно то, что требует чек-лист 4.3 («заполняет обе строки RU/EN,
  **помечает переопределённые значения**» — значения, не запись). Флаг `IsOverridden`
  избыточен: сигнал «переопределено» = «есть own-строка перевода», как в `SiteSettings`.
- **Геометрия и фото `Place` НЕ переопределяются** на уровне тура. `RoutePoint` не заводит
  своих координат/региона/фото — при `PlaceId != null` регион/координаты/фото всегда из
  каталога (это прямое следствие решения 3.2 «второй источник географии заводить нельзя»).
  Переопределяется только текстовая подпись точки.
- **`AdditionalExpense.Amount` остаётся сугубо per-tour** и в шаблоне не хранится (см. D-8).
  Из каталога наследуется только описание расхода; сумму каждый тур задаёт сам.
- **`TourNote.Type` при привязке обязан совпадать с `TourNoteTemplate.Type`** (нельзя
  привязать орг.деталь к шаблону-ограничению) — правило валидации, см. 3.4.6.

**Граница слоёв:** правило приоритета override — бизнес-правило, живёт в **Service**
(новый статический резолвер), НЕ в маппере, НЕ в `Common`, НЕ в SQL. Маппер только
перекладывает поля; резолвер знает про «own ?? template».

#### 3.4.2 Сущности (`ATTours.Common/Entities/`)

```
Place : EntityBase
    string Slug                                  // unique, 64 (как Region.Slug)
    int RegionId                                 // FK → Region, Restrict (рекомендую required, см. 3.4.3)
    decimal? Latitude                            // (9,6), nullable
    decimal? Longitude                           // (9,6), nullable
    string ImageUrl                              // nullable, как Tour.MainImageUrl / GalleryImage.Url
    int SortOrder
    Region Region
    HashSet<PlaceTranslation> Translations        // имя точки, RU/EN
    HashSet<RoutePoint> RoutePoints               // inverse, для Restrict + счётчика использования

PlaceTranslation : EntityBase                    // одно текстовое поле, своего Type нет
    int PlaceId
    LanguageCode LanguageCode
    string Value
    Place Place

ExpenseTemplate : EntityBase
    int SortOrder
    HashSet<ExpenseTemplateTranslation> Translations   // описание, RU/EN
    HashSet<AdditionalExpense> AdditionalExpenses       // inverse

ExpenseTemplateTranslation : EntityBase          // своего Type нет
    int ExpenseTemplateId
    LanguageCode LanguageCode
    string Value
    ExpenseTemplate ExpenseTemplate

TourNoteTemplate : EntityBase
    TourNoteType Type                            // переиспользуем enum из 3.3 (OrganizationalDetail=1, Restriction=2)
    int SortOrder
    HashSet<TourNoteTemplateTranslation> Translations   // текст, RU/EN
    HashSet<TourNote> TourNotes                          // inverse

TourNoteTemplateTranslation : EntityBase         // своего Type нет (как TourNoteTranslation)
    int TourNoteTemplateId
    LanguageCode LanguageCode
    string Value
    TourNoteTemplate TourNoteTemplate
```

**Правки существующих сущностей (все три — additive nullable FK):**
```
RoutePoint       += int? PlaceId;             Place Place                       // Restrict
AdditionalExpense+= int? ExpenseTemplateId;   ExpenseTemplate ExpenseTemplate   // Restrict
TourNote         += int? TourNoteTemplateId;  TourNoteTemplate TourNoteTemplate // Restrict
```
`Place` += `HashSet<RoutePoint> RoutePoints`, `ExpenseTemplate` += `HashSet<AdditionalExpense>`,
`TourNoteTemplate` += `HashSet<TourNote>` (inverse-навигации нужны для конфигурации FK и
проверки «в использовании» при удалении).

Ни одна новая таблица не содержит колонок `TitleRu`/`TitleEn` — третий язык = `LanguageCode.Armenian=3`
+ строки переводов, схема не меняется (критерий этапа соблюдён).

#### 3.4.3 EF-конфигурации (`Infrastructure/EntityConfiguration/`)

- `PlaceConfiguration`: `Slug` required 64 + **unique index** (как `RegionConfiguration`);
  `HasMany(Translations)` → Cascade; `HasOne(Region).WithMany(r => r.Places?).HasForeignKey(RegionId)` →
  **Restrict** (регион нельзя удалить, пока он у точки — тот же принцип, что `TourRegion→Region`).
  Навигацию `Region.Places` заводить не обязательно: FK можно сконфигурировать через
  `.WithMany()` без обратной коллекции. `Latitude`/`Longitude` `HasPrecision(9,6)`.
- `PlaceTranslationConfiguration`: `Value` required (длина — как `RegionTranslation`, 400).
- `ExpenseTemplateConfiguration`: `HasMany(Translations)` → Cascade.
- `ExpenseTemplateTranslationConfiguration`: `Value` required 4000 (как `AdditionalExpenseTranslation`/`TourNoteTranslation`).
- `TourNoteTemplateConfiguration`: `HasMany(Translations)` → Cascade;
  `HasIndex(x => x.Type)` — опционально (каталог мелкий); индекс необязателен.
- `TourNoteTemplateTranslationConfiguration`: `Value` required 4000.

**Nullable-FK «ссылка на каталог» — где конфигурируется:** у tour-level сущности два разных
родителя с разным `OnDelete` (свой владелец каскадит, шаблон — Restrict), поэтому FK на шаблон
конфигурируется в конфигурации **дочерней** сущности (как сделали для `TourRegion` в 3.2),
рядом с существующим FK на владельца:
```
// RoutePointConfiguration (владелец TourDay уже есть):
builder.HasOne(x => x.Place).WithMany(p => p.RoutePoints)
    .HasForeignKey(x => x.PlaceId).OnDelete(DeleteBehavior.Restrict);
// аналогично AdditionalExpenseConfiguration → ExpenseTemplate,
//           TourNoteConfiguration → TourNoteTemplate
```
Nullable-FK + Restrict на стороне шаблона: множественных каскадных путей SQL Server не
возникает (шаблон ничего не каскадит), владелец (`Tour`/`TourDay`) каскадит как раньше.

**Почему Restrict, а не SetNull:** при `SetNull` удаление шаблона у «привязанной, не
переопределённой» строки обнулило бы FK и запись потеряла бы весь текст (своего перевода
нет). Restrict заставляет каталог оставаться целостным, пока на него ссылаются, — но требует
проверки «в использовании» при удалении (см. 3.4.6, код `CatalogEntryInUse`).

**DbSet (`ATToursContext`):** += `Places`, `PlaceTranslations`, `ExpenseTemplates`,
`ExpenseTemplateTranslations`, `TourNoteTemplates`, `TourNoteTemplateTranslations`
(6 новых, в конец списка).

#### 3.4.4 Разрешение override — где именно в Service

Новый статический резолвер в слое Service (namespace `ATTours.BusinessServices.*`), напр.
`Services/InfoServices/CatalogOverrideResolver.cs`:
```
string Resolve(ICollection<TOwnTr> own, ICollection<TTemplateTr> template, int languageCode)
    // own(lang)?.Value ?? template(lang)?.Value  (обе строки берутся по LanguageCode)
```
Используется на **публичном пути чтения тура (пункт 3.5)** — там граф тура превращается в
эффективные значения. Для этого пути `TourGraphQueryExtensions` (или отдельный публичный
запрос) добавляет `ThenInclude` на переводы шаблонов:
`RoutePoint→Place→Translations`, `AdditionalExpense→ExpenseTemplate→Translations`,
`TourNote→TourNoteTemplate→Translations`.

**Админский путь чтения тура (`InitUpdate`/`GetTourInfo`/`GetAll`) остаётся «сырым»:**
возвращает `placeId`/`expenseTemplateId`/`tourNoteTemplateId` + own-переводы как есть, БЕЗ
резолва и БЕЗ include переводов шаблонов. Админка сама тянет каталоги из новых контроллеров
(как названия регионов из `RegionController` в 3.2) и отрисовывает селектор 4.3 с маркером
«переопределено». Так админка видит и ссылку, и факт override, а не схлопнутое значение.
Это развилка **D-7** (что именно возвращает граф тура).

Поэтому в 3.4 **общий `IncludeTourGraph` не утяжеляется** переводами шаблонов — включения для
резолва добавляются на публичном пути в 3.5. 3.4 добавляет только FK-колонки и их проброс в DTO.

#### 3.4.5 DTO

**Каталоги (полный CRUD, т.к. админка 4.2 ими управляет) — `ATTours.Common/DTO/`:**
```
Info/PlaceInfoModel            { Id, Slug, RegionId, string RegionSlug, decimal? Latitude,
                                 decimal? Longitude, string ImageUrl, SortOrder,
                                 List<TranslatableInfoModel> Translations }
Init/PlaceCreateModel          { Slug, RegionId, Latitude, Longitude, ImageUrl, SortOrder,
                                 List<TranslatableCreateModel> Translations }
Info/ExpenseTemplateInfoModel  { Id, SortOrder, List<TranslatableInfoModel> Translations }
Init/ExpenseTemplateCreateModel{ SortOrder, List<TranslatableCreateModel> Translations }
Info/TourNoteTemplateInfoModel { Id, TourNoteType Type, SortOrder, List<TranslatableInfoModel> Translations }
Init/TourNoteTemplateCreateModel{ TourNoteType Type, SortOrder, List<TranslatableCreateModel> Translations }
```
Update у каталогов идёт через Info-модель (с `Id`), как `UpdateTour` через `TourInfoModel` —
отдельных Update-DTO не заводим. `RegionSlug` в `PlaceInfoModel` денормализован (плоско, как
`Slug` в `TourRegionInfoModel`), чтобы админка не тянула регион с переводами.
Create-модели — namespace `ATTours.Common.Dto.Init` (строчное `Dto`, как у соседей графа тура).

**Правки существующих tour-графовых DTO (additive, nullable):**
```
RoutePointInfoModel          += int? PlaceId
RoutePointCreateModel        += int? PlaceId
AdditionalExpenseInfoModel   += int? ExpenseTemplateId
AdditionalExpenseCreateModel += int? ExpenseTemplateId
TourNoteInfoModel            += int? TourNoteTemplateId
TourNoteCreateModel          += int? TourNoteTemplateId
```
`null` = свободная запись без каталога. Поле новое и опциональное → фронт игнорирует
неизвестное, старые запросы без него валидны. **Контракт тура НЕ ломается** (в отличие от 3.3).

#### 3.4.6 Сервисы, валидация, коды ошибок

**По три вертикальных среза (по образцу `Region`/`Tour`, БЕЗ generic-каталог-базы —
консистентность важнее DRY; см. «Спорное» ниже):**
```
InfoServices/PlaceInfo               : EntityInfoBase<Place>             // Include(Translations)+Include(Region); GetForClient(lang)
CreateServices/PlaceCreationService  : CreateVerifiableEntityBase<Place, ATToursContextFactory>
UpdateServices/PlaceUpdateService    : EntityActionServiceBase<Place, ATToursContextFactory>   // reconcile Translations
UpdateServices/PlaceDeletionService  : (по образцу TourDeletionService) — проверка «в использовании»
ValidationServices/PlaceValidationService : EntityValidationContextDependentBase<Place, ATToursContextFactory>
```
Аналогичная четвёрка+валидация для `ExpenseTemplate` и `TourNoteTemplate` (у них нет `Slug`/
`Region`, валидация проще). У всех — конструктор с `IApplicationDbContext` для будущего DI.

**Правила валидации каталогов:**
- `Place`: `Slug` уникален (дубль в запросе/БД → 400); `RegionId` существует → иначе 400 `RegionNotFound` (2006, уже есть).
- удаление любого шаблона/точки, на которые ссылается хотя бы одна tour-level строка → 400 `CatalogEntryInUse` (не полагаться только на Restrict в БД — отдать внятный код, а не сырое FK-нарушение из `MsSqlContextExceptionHandlerChain`).

**Правки `TourValidationService`** (он уже `EntityValidationContextDependentBase<Tour, …>` с 3.2,
`Context` доступен — расширяем, второй сервис не заводим):
- `RoutePoint.PlaceId` (когда не null) существует → иначе 400 `PlaceNotFound`;
- `AdditionalExpense.ExpenseTemplateId` (не null) существует → иначе 400 `ExpenseTemplateNotFound`;
- `TourNote.TourNoteTemplateId` (не null) существует **и** `TourNote.Type == template.Type` →
  иначе 400 `TourNoteTemplateNotFound` (несуществующий) / `InvalidEntityRelation` (тип не совпал).

**Новые коды `GlobalErrorCode`** (регион `EntityErrors`, сейчас занято до **2006**, следующий свободный — **2007**):
```
PlaceNotFound            = 2007   // 400, RoutePoint.PlaceId ссылается в никуда
ExpenseTemplateNotFound  = 2008   // 400, AdditionalExpense.ExpenseTemplateId ссылается в никуда
TourNoteTemplateNotFound = 2009   // 400, TourNote.TourNoteTemplateId ссылается в никуда
CatalogEntryInUse        = 2010   // 400, попытка удалить шаблон/точку, на которые ссылаются туры
```
Дубль слага `Place` и несовпадение `TourNote.Type` с типом шаблона — через существующий
`InvalidEntityRelation` (2001), отдельные коды не плодим. Новых цепочек `IExceptionHandlerChain`
не нужно — `ErrorModelExceptionHandlerChain` покрывает всё.

#### 3.4.7 Контроллеры (`ATTours.ClientAPI/Controllers/`, текущий стиль — `new Service()` + `using`, без DI, только `IMapper`)

`PlaceController` (`api/Place`), `ExpenseTemplateController`, `TourNoteTemplateController` —
одинаковый CRUD-паттерн (он же станет образцом для вкладки «Регионы» из 4.2, CRUD которой
3.2 отложил):

| Метод | Route | Вход | Возврат |
| --- | --- | --- | --- |
| GET | `GetAll` | — | `List<XxxInfoModel>` (оба языка) |
| GET | `GetForClient` | `languageCode` | `List<XxxInfoModel>` (одна локаль) |
| POST | `Create` | `XxxCreateModel` | `XxxInfoModel` |
| PUT | `Update` | `XxxInfoModel` | `XxxInfoModel` |
| DELETE | `Delete` | `id` | 200 / `CatalogEntryInUse` |

**Mapper (`MappingProfile.cs`):** блоки `PLACE`/`EXPENSETEMPLATE`/`TOURNOTETEMPLATE`
(Entity↔Info, Create→Entity, перевод `*Translation → TranslatableInfoModel` с `Type→0`) +
в существующих `RoutePoint`/`AdditionalExpense`/`TourNote` блоках проброс нового `…TemplateId`/
`PlaceId` (additive). Резолв override в маппере **не делаем** — он в Service (3.4.4).

#### 3.4.8 Миграция

Одна схемная миграция **`AddReferenceCatalogs`**, генерируется поверх
`20260729183450_MergeRestrictionAndOrganizationalDetailIntoTourNote` (последняя в цепочке):
6 `CreateTable` (`Place`,`PlaceTranslation`,`ExpenseTemplate`,`ExpenseTemplateTranslation`,
`TourNoteTemplate`,`TourNoteTemplateTranslation`), unique index `Place.Slug`, 3 `AddColumn`
nullable FK (`RoutePoint.PlaceId`,`AdditionalExpense.ExpenseTemplateId`,`TourNote.TourNoteTemplateId`)
+ их FK-индексы, FK `Place→Region` Restrict, FK шаблонов Restrict.

**Сида нет** — каталоги стартуют пустыми (рекомендация D-6), поэтому отдельной data-миграции
не нужно (в отличие от `SeedArmenianRegions`). Существующие `RoutePoint`/`AdditionalExpense`/
`TourNote` остаются с FK=null (свободные записи) — данные не трогаются, миграция не рискует
их потерять (не повторяет сложность 3.3). Линейный порядок цепочки:
`AddSiteSettings → AddRegionAndTourRegion → SeedArmenianRegions →
MergeRestrictionAndOrganizationalDetailIntoTourNote → AddReferenceCatalogs`.

#### 3.4.9 Затрагиваемые существующие файлы

- Сущности: `RoutePoint.cs`, `AdditionalExpense.cs`, `TourNote.cs` (+nullable FK, +nav).
- Конфигурации: `RoutePointConfiguration.cs`, `AdditionalExpenseConfiguration.cs`,
  `TourNoteConfiguration.cs` (+FK на шаблон, Restrict).
- DTO: `RoutePointInfoModel`/`RoutePointCreateModel`, `AdditionalExpenseInfoModel`/
  `AdditionalExpenseCreateModel`, `TourNoteInfoModel`/`TourNoteCreateModel` (+`…TemplateId`).
- `ATToursContext.cs` (+6 DbSet). `GlobalErrorCode.cs` (+2007…2010).
- Service: `TourValidationService.cs` (валидация FK+тип), `TourGraphQueryExtensions.cs`
  (include шаблонных переводов — только на публичном пути 3.5, не в общий граф),
  новый `CatalogOverrideResolver.cs`.
- `MappingProfile.cs` (3 новых блока + проброс FK в tour-графовых блоках).
- `TourUpdateService.cs`: `ReconcileCollection` для `RoutePoints`/`AdditionalExpenses`/`Notes`
  дополнить копированием нового FK (`t.PlaceId = s.PlaceId` и т.п.) — как копируется `Type` у `Notes`.
  Правило `null`/`[]` тут НЕ применять (оно только для `Regions`, §3.2.9).
- `TourInitializationService.cs`: FK новых полей в скелете = `null` (свободные записи) —
  проброс не требует изменений, но проверить, что `InitTour` их не роняет.

**НЕ трогаются:** `TourDeletionService` (tour-level строки каскадят от тура/дня как раньше;
Restrict висит на стороне каталога, тур это не задевает), клиентские фильтры 3.0,
контрактное правило `Regions`, `SiteSetting*`/`Region*`.

#### 3.4.10 Развилки — нужно решение Давида

**D-5. Как технически моделировать override.**
- **A (рекомендую).** nullable-FK на шаблон + существующая коллекция `Translations` как
  override-строки; эффективное значение = `own(lang) ?? template(lang)` в Service; «привязано,
  не переопределено» = FK есть, own-строки на язык нет. Флага `IsOverridden` и снапшот-копии нет.
  *Плюсы:* один источник правды, override гранулярен по языку (ровно под маркер 4.3), тот же
  паттерн, что уже отлажен в `SiteSettings`; правка каталога честно доходит до всех
  непереопределённых туров. *Минусы:* «переопределено» вычисляется (own-строка есть?), а не
  читается из колонки — фронту 4.3 надо это вычислять при отрисовке.
- **B.** nullable-FK + явный `bool IsOverridden` + всегда хранимая копия значения (снапшот при
  выборе из каталога). *Плюсы:* «переопределено» читается колонкой; значение всегда локально.
  *Минусы:* два источника правды («флаг» vs «есть своя строка»), они разъезжаются; правка
  каталога доходит до тура только пока флаг=false, а копия всё равно лежит устаревшая; фронт
  обязан вести флаг руками. Дороже и хрупче.

> Рекомендую **A**. **B** оправдан только если продукту нужно «переопределение всей записи
> целиком одним тумблером», а не по значению — но 4.3 говорит про пометку значений.

**D-6. Мигрировать существующие `RoutePoint`/`AdditionalExpense`/`TourNote` в каталоги или
каталоги стартуют пустыми.**
- **A (рекомендую).** Пустые каталоги, все существующие строки — FK=null (свободные,
  поведение не меняется). Без data-миграции. Админка наполняет каталоги дальше и привязывает
  туры через селектор 4.3.
- **B.** Data-миграция: дедуп существующих текстов (пары RU+EN) в записи каталога и привязка.
  *Цена:* нечёткий дедуп двуязычных строк, риск ошибочных слияний, необратимость, тяжёлая
  миграция уровня 3.3 при мизерном объёме данных.

> Рекомендую **A**. Объём данных мал, ручная перепривязка из админки безопаснее авто-дедупа.

**D-7. Что возвращает граф тура по каталожным полям.**
- **A (рекомендую).** Админский путь чтения — «сырой»: `…TemplateId`/`PlaceId` + own-переводы,
  без резолва; резолв «override ?? template» только на публичном пути (3.5). Админка тянет
  каталоги отдельными запросами и сама рисует маркер override.
  *Плюсы:* админка видит и ссылку, и факт override (иначе селектор 4.3 не отрисовать); общий
  `IncludeTourGraph` не тяжелеет переводами шаблонов.
  *Минусы:* публичный и админский пути чтения расходятся (один резолвит, другой нет).
- **B.** Всегда резолвить (и для админки): граф тура отдаёт готовые эффективные значения.
  *Плюсы:* один путь чтения. *Минусы:* админка теряет информацию «это из каталога / это
  переопределено» — селектор 4.3 нечем отрисовать; каждый tour read тянет переводы всех шаблонов.

> Рекомендую **A**. Публичному сайту нужно значение, админке — ссылка+флаг; это разные
> read-модели, склеивать их в одну вредно.

**D-8. Несёт ли `ExpenseTemplate` дефолтную сумму; и что переопределяемо у `Place`.**
- **A (рекомендую).** `ExpenseTemplate` = только текст(RU/EN)+`SortOrder`; `Amount` всегда
  per-tour на `AdditionalExpense`, из каталога не наследуется. У `Place` переопределяется
  только подпись; регион/координаты/фото — всегда из каталога, на уровне тура не
  переопределяются.
  *Плюсы:* нет неоднозначности `Amount==null` («наследовать» vs «бесплатно»); география —
  один источник правды (решение 3.2). *Минусы:* сумму нельзя предзаполнить из каталога.
- **B.** `ExpenseTemplate` несёт `DefaultAmount`, тур его наследует/переопределяет; и/или
  `Place`-координаты переопределяемы на уровне точки тура.
  *Минусы:* возвращает `Amount==null`-неоднозначность и второй источник географии, который
  3.2 прямо запретил.

> Рекомендую **A**. Сумма расхода почти всегда тур-специфична, а география точки по решению
> 3.2 обязана иметь единственный источник — каталог.

#### 3.4.11 Спорное / заметки для ревью (не развилки)

1. **Три отдельных вертикальных среза vs generic-каталог-база.** Три каталога структурно
   близки (переводимый справочник + `SortOrder`), и `DataConversion`-базы соблазняют вынести
   их в один generic-слой. Рекомендую **отдельные срезы** — так сделаны `Region` (3.2) и
   `TourNote` (3.3), проект держит явные per-entity слайсы, а не generic-CRUD. Цена: ~4-5
   сервис-файлов × 3 каталога. Если Давид захочет generic-базу — это отдельное решение с ADR
   (кандидат ADR 004), но по умолчанию идём проверенным путём предшественника.
2. **Контроллеры без DI множатся дальше** — после 3.1/3.2 добавляется ещё три. Тот же
   зафиксированный техдолг, что в §8.1 архитектурного документа; все новые сервисы уже с
   конструктором `IApplicationDbContext`, перевод на DI — механический.
3. **Unique-индекс на переводы по-прежнему не заводится** (ни у одной `*Translation` проекта) —
   новые три `*TemplateTranslation`/`PlaceTranslation` следуют тому же соглашению (§8.4 арх.док).
4. **ADR по override-модели** будет уместен ПОСЛЕ решения D-5 (сейчас писать нечего —
   решение не принято). Предшественник вёл ADR только по принятому.

#### Для `backend-developer` (когда придёт «go» на 3.4)

- `GlobalErrorCode` занят до **2006**; 3.4 занимает **2007…2010**.
- Последняя миграция цепочки — `20260729183450_MergeRestrictionAndOrganizationalDetailIntoTourNote`;
  `AddReferenceCatalogs` генерируется поверх неё.
- `TourValidationService` — расширять существующий (он уже context-dependent), не заводить второй.
- Резолв override — в Service (`CatalogOverrideResolver`), не в маппере и не в `Common`.
- Реализацию начинать только после решения Давида по **D-5…D-8** — от D-5/D-8 зависит форма
  сущностей и DTO.

### 2026-07-30 — РЕШЕНИЯ ДАВИДА по D-5…D-8 (ЗАМОРОЖЕНЫ)

Давид ответил по всем четырём — везде выбран **вариант A** (рекомендация архитектора).
Переспрашивать и переигрывать нельзя.

- **D-5 = A.** Override = **nullable-FK на шаблон + существующая коллекция `Translations`
  как override-строки**; эффективное значение `own(lang) ?? template(lang)` резолвится в
  слое Service (`CatalogOverrideResolver`). Флага `IsOverridden` и снапшот-копии НЕТ.
  Override гранулярен по языку (есть own-строка на `LanguageCode` = переопределено).
- **D-6 = A.** Каталоги стартуют **пустыми**, все существующие `RoutePoint`/
  `AdditionalExpense`/`TourNote` — с FK=null (свободные записи). Data-миграции НЕТ, только
  схемная `AddReferenceCatalogs`. Наполнение каталогов и привязка туров — через админку (4.2/4.3).
- **D-7 = A.** Админский путь чтения тура — **«сырой»**: `placeId`/`expenseTemplateId`/
  `tourNoteTemplateId` + own-переводы, БЕЗ резолва и БЕЗ include переводов шаблонов. Резолв
  «override ?? template» — только на публичном пути 3.5. Админка тянет каталоги отдельными
  контроллерами и сама рисует маркер override (под селектор 4.3). Общий `IncludeTourGraph`
  переводами шаблонов НЕ утяжеляется в 3.4.
- **D-8 = A.** `ExpenseTemplate` = только текст(RU/EN)+`SortOrder`; `AdditionalExpense.Amount`
  ВСЕГДА per-tour, из каталога не наследуется. У `Place` переопределяется только текстовая
  подпись; регион/координаты/фото — единственный источник в каталоге, на уровне тура не
  переопределяются (прямое следствие 3.2 «второй источник географии заводить нельзя»).

**Следствия для реализации (зафиксированы):** контракт API тура НЕ ломается (только additive
nullable FK-поля); одна схемная миграция `AddReferenceCatalogs` без сида поверх
`MergeRestrictionAndOrganizationalDetailIntoTourNote`; три отдельных вертикальных среза
(не generic-каталог-база); `GlobalErrorCode` 2007…2010. ADR по override-модели (кандидат
ADR 004) можно писать теперь, когда D-5 принят. **Go на реализацию 3.4 дан** — дальше
скилл `new-backend-feature` (скелеты) → `backend-developer` (бизнес-логика override).

### 2026-07-30 — backend-developer, 3.4 (реализовано)

Реализован весь вертикальный срез 3.4 строго по решению архитектора и D-5…D-8 (все = A).
Сборка `dotnet build ATTours.slnx --no-incremental`: **0 Errors, 30 Warning(s)** — ровно
базовый набор (NU1903 + CS86xx в инфраструктуре ContextRepository/DataLayer), новых
предупреждений нет. Миграция сгенерирована `dotnet ef migrations add`, `database update`
НЕ запускался (накатывает Давид).

**Созданные файлы (37 .cs + миграция):**
- Сущности (`ATTours.Common/Entities/`): `Place`, `PlaceTranslation`, `ExpenseTemplate`,
  `ExpenseTemplateTranslation`, `TourNoteTemplate`, `TourNoteTemplateTranslation`.
- EF-конфигурации (`.../EntityConfiguration/`): по одной на каждую из 6 сущностей.
  `PlaceConfiguration` — `Slug` unique 64, `Latitude`/`Longitude` `HasPrecision(9,6)`,
  `Region` через `.WithMany()` (без обратной коллекции) `OnDelete Restrict`.
- DTO Info: `PlaceInfoModel` (с денормализованным `RegionSlug`), `ExpenseTemplateInfoModel`,
  `TourNoteTemplateInfoModel`. DTO Init (namespace `ATTours.Common.Dto.Init`):
  `PlaceCreateModel`, `ExpenseTemplateCreateModel`, `TourNoteTemplateCreateModel`.
- Сервисы (`ATTours.Service/Services/`): по срезу на каждый каталог — `*Info` (+`GetByIdAsync`),
  `*CreationService`, `*UpdateService`, `*DeletionService`, `*ValidationService`;
  плюс `InfoServices/CatalogOverrideResolver.cs`. У всех сервисов есть конструктор с
  `IApplicationDbContext` для будущего DI.
- Контроллеры (`ATTours.ClientAPI/Controllers/`): `PlaceController`, `ExpenseTemplateController`,
  `TourNoteTemplateController` (текущий стиль `new Service()`+`using`, только `IMapper`;
  CRUD `GetAll`/`GetForClient`/`Create`/`Update`/`Delete`).
- Миграция `20260730190810_AddReferenceCatalogs`.

**Изменённые файлы:**
- Сущности: `RoutePoint` (+`int? PlaceId`, `Place`), `AdditionalExpense`
  (+`int? ExpenseTemplateId`, `ExpenseTemplate`), `TourNote` (+`int? TourNoteTemplateId`,
  `TourNoteTemplate`).
- Конфигурации `RoutePointConfiguration`/`AdditionalExpenseConfiguration`/`TourNoteConfiguration`
  — FK на шаблон в конфигурации дочерней сущности, `OnDelete Restrict`.
- DTO: `RoutePoint*`/`AdditionalExpense*`/`TourNote*` Info+Create (+ additive `int? …Id`).
- `ATToursContext` (+6 DbSet). `GlobalErrorCode` (+`PlaceNotFound=2007`,
  `ExpenseTemplateNotFound=2008`, `TourNoteTemplateNotFound=2009`, `CatalogEntryInUse=2010`).
- `LanguageExtensions` (+`ExtractWithNeededLanguage`/…`FromCollection` для 3 каталогов).
- `TourValidationService` (расширен: существование `PlaceId`/`ExpenseTemplateId`/
  `TourNoteTemplateId` при не-null + `TourNote.Type == template.Type`).
- `TourUpdateService` (`ReconcileCollection` для RoutePoints/AdditionalExpenses/Notes
  дополнен копированием нового FK; правило `null`/`[]` не применялось).
- `MappingProfile` (блоки PLACE/EXPENSETEMPLATE/TOURNOTETEMPLATE + переводы + проброс FK
  в tour-графовых блоках; override в маппере НЕ резолвится).
- `TourInitializationService` — проверен, изменений не потребовал (новые FK = null в скелете).

**Миграция — «форма».** `Up()` чисто additive: 3 `AddColumn` nullable
(`TourNote.TourNoteTemplateId`, `RoutePoint.PlaceId`, `AdditionalExpense.ExpenseTemplateId`) +
6 `CreateTable` + индексы (в т.ч. unique `IX_Place_Slug`, `IX_TourNoteTemplate_Type`) +
3 `AddForeignKey` Restrict на шаблоны, FK `Place→Region` Restrict, FK переводов Cascade.
**Никаких `DropTable`/`DropColumn`/data-операций в `Up()`** — ловушка 3.3 не повторяется,
существующие данные не трогаются. Сида нет. Прочитано глазами — подтверждено.

**Самостоятельные микрорешения (спека не задавала явно):**
1. Контроллеры после `Create`/`Update` повторно читают запись через `*Info.GetByIdAsync`
   и возвращают полную Info-модель (для `Place` иначе не заполнить денормализованный
   `RegionSlug`). Цена — один лёгкий запрос на запись; единообразно для всех трёх каталогов.
2. Reconcile переводов по `Id` реализован приватным методом ВНУТРИ каждого `*UpdateService`
   (не общий helper) — чтобы честно держать «три отдельных среза, без generic-каталог-базы».
3. Проверка «дубль языка в переводах» добавлена во все три `*ValidationService` (у `Place` —
   поверх Slug-unique + RegionId-exists). Спека требовала только Slug/Region у `Place`; дубль
   языка — дешёвый additive-гард против двух строк на один язык.
4. `ExpenseTemplate`/`TourNoteTemplate` валидации сделаны context-dependent
   (`EntityValidationContextDependentBase`) ради единообразия срезов и будущего DI, хотя их
   текущие правила БД не требуют.
5. `*DeletionService` при отсутствии записи бросает `PlaceNotFound`/`ExpenseTemplateNotFound`/
   `TourNoteTemplateNotFound` со статусом 404 (переиспользование кодов 2007–2009, которые
   спека описывала для 400 «ссылка в никуда»). «В использовании» → `CatalogEntryInUse` (400).
6. `TourNoteTemplate` GetAll/GetForClient сортируется `OrderBy(Type).ThenBy(SortOrder)`
   (как заметки тура); `Place`/`ExpenseTemplate` — `OrderBy(SortOrder)`.
7. `CatalogOverrideResolver` сделан generic с селекторами `Func<…,(int,string)>` (а не через
   общий интерфейс переводов): entity-translation не имеют общего контракта, а расширять
   существующие переводы, не входящие в список правок 3.4, здесь нельзя. Возвращает `string?`.
   В 3.4 создан, но НЕ вызывается (D-7: админский путь «сырой»).
8. В маппере новые nav-свойства (`Place`/`ExpenseTemplate`/`TourNoteTemplate`) явно
   `Ignore()`-нуты в Create/Info→Entity — по стилю проекта (валидация конфигурации AutoMapper
   в `Startup` не включена, но единообразие сохранено).

**Отступлений от архитектурного решения нет.** Не тронуты: `SiteSetting*`, `Region*`/
`TourRegion*`, клиентские фильтры 3.0, контрактное правило `Regions` null/[],
`TourDeletionService`, `TourGraphQueryExtensions` (переводами шаблонов НЕ утяжелён — D-7),
фронтенд, ADR-файлы.

**Осталось на `backend-tester` (следующая сессия):**
- Накат миграции (`dotnet ef database update`) делает Давид вручную; из сессии агента LocalDB
  недостижим — не запускалось.
- Ручной прогон через Swagger/.http: CRUD трёх новых контроллеров (вкл. `CatalogEntryInUse`
  при удалении используемого шаблона/точки, дубль слага `Place` → `InvalidEntityRelation`,
  несуществующий `RegionId` → `RegionNotFound`).
- Create/Update тура с заполненными `PlaceId`/`ExpenseTemplateId`/`TourNoteTemplateId`:
  проверка существования и `TourNote.Type == template.Type` (несовпадение →
  `InvalidEntityRelation`, несуществующий шаблон → `*NotFound`).
- Регресс контракта тура: существующие запросы без новых полей по-прежнему валидны
  (additive nullable), `InitTour` не роняет новые поля (= null).
- Резолвер override в 3.4 не задействован (проверка, что админский путь чтения остаётся сырым).

---

### 2026-07-31 — backend-architect, решение по 3.5 (Публичные эндпоинты для клиентского сайта)

Решение, реализацию делает `backend-developer`. Замороженные решения не переигрывались
(RU/EN; контроллеры без DI с конструктором `IApplicationDbContext`; публичный путь не
раскрывает черновики/архив; **D-7 = A**: админский путь чтения тура «сырой», резолв
`override ?? template` — ИМЕННО здесь, на публичном пути). Спорное вынесено в развилки
**D-9…D-13** — решает Давид, сам не принимаю.

#### 3.5.0 Инвентаризация — что для клиентского сайта УЖЕ готово

Бо́льшая часть публичного контракта уже стоит. 3.5 **не создаёт новую поверхность API**, а
достраивает один недостающий механизм (резолв override) на уже существующем публичном пути
чтения тура. Честно: это точечная добивка, а не новый вертикальный срез.

Уже реализовано (предыдущими пунктами этапа 3):
- **Публичный список туров** — `GET api/Tour/GetToursClient?languageCode=&region=`
  (`TourController`, файл `TourInitializationController.cs`, `#region ClientEndpoints`).
  Фильтр `IsActive && !IsArchived` (3.0) + опциональный `?region=` slug (3.2, неизвестный slug →
  пустой список). Отдаёт `List<TourInfoModel>` в одной локали через
  `ExtractWithNeededLanguageFromCollection`.
- **Публичная детальная тура** — `GET api/Tour/GetTourInfo?id=&languageCode=`. Одиночный тур по
  id + языку, not-found-фильтр (черновик/архив = 404 `TourNotFound`, как несуществующий id).
- **Публичные настройки сайта** — `GET api/SiteSettings/GetPublic?languageCode=&group=` (3.1):
  hero / контакты / соцсети / лого / SEO. → потребитель этапа 5.2 (hero).
- **Публичные регионы** — `GET api/Region/GetRegionsClient?languageCode=` + `TourCount` (3.2). →
  потребитель этапа 5.3 (карта → фильтр по региону; slug из этого списка идёт в `?region=`).
- **Каталоги** (`Place`/`ExpenseTemplate`/`TourNoteTemplate`) имеют `GetForClient` (3.4), но это
  **эндпоинты управления каталогом**, публичному сайту напрямую НЕ нужны: каталоги внутренние,
  клиент видит только их значения, уже резолвнутые ВНУТРИ тура. Отдельных публичных
  CRUD-справочников клиенту не заводим (см. D-13, вариант отклонён).

Связка с этапом 5 (потребитель):
- 5.2 hero → `SiteSettings/GetPublic` (готов).
- 5.3 карта→фильтр → `Region/GetRegionsClient` (список+`TourCount`) + `GetToursClient?region=slug`
  (готов).
- 5.1/5.4 список+детальная+состояния → `GetToursClient` / `GetTourInfo`. **Единственное, чего им
  не хватает — корректного текста у точек/расходов/заметок, привязанных к каталогу-шаблону
  (см. 3.5.1).** Состояния загрузки/ошибки/пустого — фронтовые, бэку добавлять нечего (пустой
  список и 404 уже есть).

#### 3.5.1 Чего НЕ хватает — единственный реальный пробел 3.5

После 3.4 у `RoutePoint`/`AdditionalExpense`/`TourNote` есть nullable-FK на шаблон, а текст при
`FK != null && нет own-строки на язык` живёт ТОЛЬКО в переводах шаблона. Оба публичных эндпоинта
сейчас грузят тур через общий `IncludeTourGraph` (переводы шаблонов НЕ включены — D-7) и НЕ зовут
`CatalogOverrideResolver`. Следствие — **баг публичного контракта**: у «привязанной, не
переопределённой» строки публичный ответ отдаёт **пустой список переводов** (текста нет вообще),
хотя в каталоге текст есть. Это и есть работа 3.5:

1. на публичном пути — догрузить переводы шаблонов (`ThenInclude`), **только тут**, не в общий граф;
2. свернуть `own(lang) ?? template(lang)` резолвером и отдать эффективное значение.

Всё остальное, что нужно публичному сайту, уже готово. 3.5 миграций/новых кодов ошибок/новых
сущностей не вводит.

#### 3.5.2 Форма публичного тура (ключевое решение — рекомендация, D-9)

**Рекомендую: отдельного public-DTO для тура НЕ заводить — публичные эндпоинты продолжают
отдавать `TourInfoModel`, но с уже резолвнутыми (`own ?? template`) значениями переводов у
точек/расходов/заметок.** Одна форма тура, переиспользуется существующая AutoMapper-конфигурация.
Публичный и админский пути расходятся не формой DTO, а тем, ЧТО кладётся в `Translations` перед
маппингом:
- **админский путь** (`GetAll`/`GetArchived`/`InitUpdate`) — own-переводы как есть, `…TemplateId`
  проброшен, резолва нет (D-7);
- **публичный путь** — `Translations` каждой каталог-привязанной строки заменяется на **одну
  строку с эффективным значением** для запрошенного языка.

Как резолв складывает переводы шаблона в переводы точки/расхода/заметки (по языку):
для строки с `FK != null` берётся `CatalogOverrideResolver.Resolve(own.Translations,
template.Translations, lang, …)` → `own(lang)?.Value ?? template(lang)?.Value`; результат кладётся
как единственная `Translation {LanguageCode=lang, Value=effective}` (при `null` — пустой список,
честное «не заполнено»). Для строки с `FK == null` — прежнее поведение (own, отфильтрованные по
языку). Это ровно тот же принцип «одна локаль на выходе», что уже даёт `ExtractWithNeededLanguage`
в `GetTourInfo`: публичный ответ и раньше содержал один язык, 3.5 лишь добавляет шаг «сначала
резолвни шаблон, потом оставь язык».

Граница слоёв (важно): существующий `ExtractWithNeededLanguage` живёт в
`ATTours.Common.Extensions.LanguageExtensions` и умеет только удалять строки чужого языка. Резолв
`own ?? template` — **бизнес-правило и требует `CatalogOverrideResolver` (слой Service)**, поэтому
шаг сворачивания **нельзя** дописывать в `LanguageExtensions` (Common не ссылается на Service). Он
живёт в новом Service-методе (см. 3.5.3). Common-экстеншен не трогаем.

Осознанная цена варианта A: `TourInfoModel` на публичном пути несёт админ-ориентированные поля
(`…TemplateId`, `Notes.Type`, `IsActive`/`IsArchived`, `SortOrder`) — они безвредны, но
«протекают» наружу. Кто хочет чистую публичную модель без них — вариант B в D-9.

#### 3.5.3 Где подключается `CatalogOverrideResolver` и какие `ThenInclude` добавляются

Резолвер (создан в 3.4, `Services/InfoServices/CatalogOverrideResolver.cs`, generic со
селекторами, возвращает `string?`) вызывается на **публичном пути чтения тура** в слое Service.
Подключение — тремя новыми артефактами Service, БЕЗ правки админского графа (D-7):

1. **`TourGraphQueryExtensions.IncludeTourGraphForClient()`** (новый метод рядом с
   `IncludeTourGraph`) = весь существующий `IncludeTourGraph()` + три `ThenInclude` **только для
   публичного пути**:
   - `RoutePoint → Place → Place.Translations`,
   - `AdditionalExpense → ExpenseTemplate → ExpenseTemplate.Translations`,
   - `TourNote → TourNoteTemplate → TourNoteTemplate.Translations`.
   Общий `IncludeTourGraph()` **не трогается** — админский путь (`TourInfo`) остаётся лёгким и
   сырым. Гео/фото `Place` (`Latitude`/`Longitude`/`ImageUrl`/`RegionId`) в резолве не участвуют —
   переопределяется только текстовая подпись (D-8); включать их в публичный тур сейчас не нужно
   (см. D-13).

2. **Публичный read-path в Service.** Рекомендую отдельный `InfoServices/TourClientInfo :
   EntityInfoBase<Tour>`, переопределяющий `GetEntityQueryableRepository()` на
   `IncludeTourGraphForClient()` (клиентская read-модель отделена от админской `TourInfo` — прямое
   следствие D-7: «это разные read-модели»). Переиспользует `GetAllAsync(where)` для списка и даёт
   `GetClientDetailAsync(id)` для детальной. Альтернатива — добить методы прямо в `TourInfo`,
   минуя переопределённый include; развилка не для Давида (внутренняя), рекомендую `TourClientInfo`.

3. **Шаг сворачивания** — новый Service-метод (напр.
   `Services/InfoServices/TourOverrideProjection.Resolve(Tour tour, int languageCode)` или
   инстанс-метод `TourClientInfo`). Для каждой `RoutePoint`/`AdditionalExpense`/`TourNote`: если
   FK != null — заменить `Translations` на единственную строку с эффективным значением из
   `CatalogOverrideResolver`; иначе оставить own, отфильтровав по языку (эквивалент текущего
   `ExtractWithNeededLanguage`). Переводы самого тура / дня / галереи — как сегодня (у них
   каталога нет). Работает над NoTracking-графом, в БД ничего не пишется (D-10 = резолв на лету).

#### 3.5.4 Маршруты / сигнатуры (рекомендация: менять существующие in place, D-12)

Новых маршрутов и кодов ошибок НЕ добавляется. Оба публичных эндпоинта сохраняют сигнатуру,
меняется только внутренняя маршрутизация — через `TourClientInfo` + резолв:

| Метод | Route | Вход | Возврат | Что меняется |
| --- | --- | --- | --- | --- |
| GET | `api/Tour/GetToursClient` | `languageCode`, `region?` | `List<TourInfoModel>` (одна локаль, значения резолвнуты) | путь чтения → клиентский граф + резолв (или облегчить, D-11) |
| GET | `api/Tour/GetTourInfo` | `id`, `languageCode` | `TourInfoModel` (одна локаль, значения резолвнуты) | `InitUpdate` → `TourClientInfo.GetClientDetailAsync` + резолв; not-found-фильтр сохранить |

Коды ошибок: без изменений. Not-found по-прежнему `TourNotFound = 2004` (404). `GlobalErrorCode`
остаётся занятым до **2010** — 3.5 новых не добавляет.

#### 3.5.5 Затрагиваемые файлы

- `ATTours.Service/Services/InfoServices/TourGraphQueryExtensions.cs` — `+ IncludeTourGraphForClient()`.
- `ATTours.Service/Services/InfoServices/TourClientInfo.cs` — **новый** (клиентская read-модель).
- `ATTours.Service/Services/InfoServices/TourOverrideProjection.cs` — **новый** шаг сворачивания
  (зовёт `CatalogOverrideResolver`), либо инстанс-метод в `TourClientInfo`.
- `ATTours.ClientAPI/Controllers/TourInitializationController.cs` (класс `TourController`,
  `#region ClientEndpoints`) — оба клиентских метода маршрутизировать через `TourClientInfo`+резолв;
  not-found-фильтр `GetTourInfo` сохранить дословно.
- `CatalogOverrideResolver.cs` — **не меняется**, только начинает вызываться.
- **НЕ трогаются:** `TourInfo` (админская read-модель), общий `IncludeTourGraph`,
  `ATTours.Common.Extensions.LanguageExtensions` (граница Common↔Service), `MappingProfile`
  (если D-9 = A и D-11 = status quo — форма DTO не меняется), `TourValidationService`,
  `TourUpdateService`, миграции, `GlobalErrorCode`, фронтенд.
- Если D-11 = B (card-DTO) — добавится `DTO/Info/TourCardModel` + блок в `MappingProfile` +
  облегчённый include; если D-9 = B (public-DTO) — параллельное дерево DTO + блоки маппера.

#### 3.5.6 Развилки — нужно решение Давида

**D-9. Форма публичного тура: резолв внутри существующего `TourInfoModel` vs отдельный public-DTO.**
- **A (рекомендую).** Публичные эндпоинты отдают `TourInfoModel` с резолвнутыми значениями; одна
  форма тура, переиспользуется маппер. *Плюсы:* минимум кода, ноль дублирования DTO, фронт этапа 5
  уже целится в эти типы. *Минусы:* наружу «протекают» админ-поля (`…TemplateId`, `Notes.Type`,
  `IsActive/IsArchived`) — безвредно, но неаккуратно; одна DTO-форма значит две семантики (сырое на
  админском пути, резолвнутое на публичном).
- **B.** Отдельное дерево `TourPublicModel`/`RoutePointPublicModel`/… без админ-полей.
  *Плюсы:* чистая публичная модель, ничего лишнего не течёт. *Минусы:* параллельное дерево DTO +
  блоки маппера, фронт этапа 5 берёт второй набор типов — много поверхности ради RU/EN-продукта
  малого объёма.
> Рекомендую **A**. **B** оправдан, только если важно не отдавать наружу ни одного админ-поля.

**D-10. Резолвить на лету при чтении vs материализовать.**
- **A (рекомендую).** Резолв на лету над NoTracking-графом, в БД ничего не пишется; правка
  каталога всегда доходит до непереопределённых туров. *Минусы:* резолв на каждый публичный read
  (дёшево — граф уже в памяти).
- **B.** Материализовать эффективные значения (снапшот). *Минусы:* противоречит уже принятому
  **D-5 = A** («снапшот-копии НЕТ»), рассинхрон с каталогом.
> Рекомендую **A**. Формально уже следует из D-5 = A — фиксирую явно, чтобы developer не соблазнился
> кэшировать в БД.

**D-11. Публичный список: отдавать полный `TourInfoModel` (как сейчас) vs облегчённый card-DTO.**
- Сейчас `GetToursClient` тянет полный граф каждого тура (дни, точки, расходы, заметки), а с 3.5
  ещё и резолвит его целиком — на список карточек это тяжело и избыточно. Карточке (client-site.md)
  нужны только: `id`, `type`, заголовок, краткое описание, `mainImageUrl`, `totalPrice`,
  длительность, регионы, УТП-бейджи.
- **A (рекомендую).** Ввести облегчённый `TourCardModel` для списка (без по-дневного графа/точек/
  расходов/заметок) → резолв на списке вообще не нужен, полный резолв только в детальной
  `GetTourInfo`. *Плюсы:* дешёвый и узкий список, меньше over-fetch, резолв ×N не выполняется.
  *Минусы:* новый DTO + блок маппера + облегчённый include; лёгкое противоречие с D-9 = A (список
  получает свой тип, детальная — `TourInfoModel`).
- **B.** Оставить полный `TourInfoModel` в списке (статус-кво), резолв применяется ко всему списку.
  *Плюсы:* ноль нового кода. *Минусы:* тяжёлый ответ и резолв всего графа каждого тура ради карточки.
> Рекомендую **A** (перф + список честно не тащит то, что карточке не нужно). Если Давид ценит
> «ноль нового кода сейчас» — **B** рабочий, оптимизацию списка можно отложить в этап 5.

**D-12. Менять существующие `GetToursClient`/`GetTourInfo` in place vs заводить новые эндпоинты.**
- **A (рекомендую).** Править существующие маршруты in place (та же сигнатура, меняется только
  внутренний путь). *Плюсы:* фронт этапа 5 уже целится в эти маршруты, ноль churn, один канонический
  публичный эндпоинт. *Минусы:* поведение эндпоинта меняется (пустые переводы → резолвнутые) — но
  это исправление бага, не слом контракта.
- **B.** Новые эндпоинты (напр. `GetTourDetailClient`), старые оставить сырыми. *Минусы:* два
  почти одинаковых публичных метода, неясно какой канонический, фронт переключает маршруты.
> Рекомендую **A**.

**D-13. Публичная точка маршрута: отдавать гео/фото `Place` (координаты/фото/регион) vs только
резолвнутую подпись.**
- Сейчас `RoutePointInfoModel = { Id, SortOrder, PlaceId, Translations }` — без координат/фото/
  региона. client-site.md на детальной странице тура пока НЕ требует по-точечных координат/фото
  (интерактивная карта — на уровне регионов/главной, не внутри тура).
- **A (рекомендую).** Публичный тур сейчас отдаёт у точки только резолвнутую подпись, гео/фото
  `Place` наружу не выносим. *Плюсы:* минимально достаточно под текущий этап 5; не тащим наружу
  каталожную географию, которой сайту сейчас нечего показывать. *Минусы:* если позже детальной
  захочется мини-карта/фото точки — добавлять тогда.
- **B.** Обогатить публичную точку `imageUrl`/`latitude`/`longitude`/`regionSlug` из `Place`.
  *Минусы:* шире DTO и проектирование под гипотетический функционал, которого в требованиях нет;
  `PlaceId` (сырой FK) — админ-ориентирован, наружу его отдавать смысла нет.
> Рекомендую **A** (минимально достаточно). **B** — когда этап 5 явно попросит гео на детальной.

#### Для `backend-developer` (когда придёт «go» на 3.5)

- 3.5 — **точечная добивка, не новый срез**: миграций нет, новых сущностей/DTO нет (если D-9 = A,
  D-11 = B-статус-кво), новых кодов ошибок нет (`GlobalErrorCode` остаётся до **2010**).
- Резолв `own ?? template` — только на публичном пути; **общий `IncludeTourGraph` и `TourInfo`
  (админ) не трогать** (D-7). Публичные `ThenInclude` шаблонных переводов — в отдельном
  `IncludeTourGraphForClient()`.
- Шаг сворачивания — в **Service** (зовёт `CatalogOverrideResolver`), НЕ в `LanguageExtensions`
  (Common), НЕ в маппере, НЕ в SQL.
- Реализацию начинать после решения Давида по **D-9…D-13** — от D-9/D-11 зависит, появляются ли
  новые DTO и правки `MappingProfile`.

### 2026-07-31 — РЕШЕНИЯ ДАВИДА по D-9…D-13 (ЗАМОРОЖЕНЫ)

Давид ответил по всем — везде **вариант A** (рекомендация архитектора). D-10 главный агент
закрыл сам как несущественную (материализация напрямую противоречит уже утверждённому D-5=A,
реального выбора нет). Переигрывать нельзя.

- **D-9 = A.** Публичная детальная тура отдаёт тот же `TourInfoModel`, но со свёрнутыми
  `own(lang) ?? template(lang)` значениями. Отдельное public-дерево DTO НЕ заводим. Резолв —
  Service-шаг над клиентским include, не в маппере/Common.
- **D-10 = A** (главный агент). Резолв «на лету» при чтении, без материализации/снапшота.
- **D-11 = A.** Публичный список туров переходит на **облегчённый `TourCardModel`** (только
  поля карточки: название/цена/фото/регионы), резолв override — только в детальной. Убирает
  over-fetch (сейчас список тянет и резолвил бы полный граф каждого тура). **Внимание developer:
  это ОТМЕНЯЕТ строчку «D-11 = B-статус-кво» из заметки архитектора выше — новый DTO
  `TourCardModel` появляется, и `GetToursClient` меняет тип возврата на `List<TourCardModel>`.**
- **D-12 = A.** Меняем существующие `GetToursClient`/`GetTourInfo` **in place** (фронт этапа 5
  уже целится в эти маршруты), новые эндпоинты не плодим. Смена типа возврата списка (D-11) —
  часть этой же правки.
- **D-13 = A.** Публичная точка маршрута отдаёт только резолвнутую подпись; гео/фото `Place`
  (координаты/фото/регион) наружу не выносим. `PlaceId` (сырой FK) в публичной детальной не нужен —
  см. ниже.

**Следствия для реализации (зафиксированы):**
- Появляется **один новый DTO `TourCardModel`** (из-за D-11=A) + маппер `Tour → TourCardModel` +
  смена типа возврата `GetToursClient`. Это единственное отклонение от «новых DTO нет» в заметке
  архитектора — оно вызвано D-11=A.
- Детальная (`GetTourInfo`) — прежний `TourInfoModel`, но значения резолвнуты; новый
  `IncludeTourGraphForClient()` с `ThenInclude` на переводы шаблонов (`Place`/`ExpenseTemplate`/
  `TourNoteTemplate`), общий `IncludeTourGraph` и админский `TourInfo` НЕ трогать (D-7).
- Резолв `own ?? template` — в Service (зовёт `CatalogOverrideResolver`).
- Миграций нет, новых кодов ошибок нет (`GlobalErrorCode` до 2010).
- **Go на реализацию 3.5 дан** — дальше `backend-developer`.

### 2026-07-31 — backend-developer, 3.5 Публичные эндпоинты (реализовано)

Реализован пункт 3.5 строго по решениям Давида D-9…D-13 (все вариант A). Миграций нет,
новых сущностей/полей БД/кодов ошибок нет. Админский путь чтения тура (`TourInfo`,
`InitUpdate`, `GetAll`, `GetArchived`), общий `IncludeTourGraph`, `SiteSetting*`/`Region*`,
контрактное правило `Regions` null/[], клиентские фильтры 3.0/3.2 — не тронуты. Фронтенд не
тронут (читался только `shared/ui/TourCard.tsx` + `shared/types/tour.ts` для сверки полей
карточки). `CatalogOverrideResolver` (создан в 3.4) не менялся — только начал вызываться.

#### Созданные файлы

`ATTours.Common`
- `DTO/Info/TourCardModel.cs` — облегчённая проекция тура для публичного списка (D-11).

`ATTours.Service` (namespace `ATTours.BusinessServices.Services.InfoServices`)
- `TourClientInfo.cs` — клиентская read-модель `EntityInfoBase<Tour>` (отделена от админской
  `TourInfo`, D-7). Два РАЗНЫХ пути: `GetCardsAsync(where)` (облегчённый card-граф для списка) и
  `GetClientDetailAsync(id)` (полный клиентский граф + переводы шаблонов для детальной).
  `GetEntityQueryableRepository()` **не переопределяется** — иначе список тянул бы тяжёлый
  клиентский граф (ровно то, что D-11 убирает); каждый путь строит include явно.
- `TourOverrideProjection.cs` — шаг сворачивания в Service (зовёт `CatalogOverrideResolver`):
  `ResolveDetail(tour, lang)` (детальная) и `ProjectCards(tours, lang)` (список).

#### Изменённые файлы

- `ATTours.Service/Services/InfoServices/TourGraphQueryExtensions.cs` — `+ IncludeTourGraphForClient()`
  (весь `IncludeTourGraph()` + `ThenInclude` на `Place.Translations`/`ExpenseTemplate.Translations`/
  `TourNoteTemplate.Translations`, только текстовые переводы; гео/фото `Place` не тянутся, D-13) и
  `+ IncludeTourCardGraph()` (тур-уровневые переводы + `TourRegions→Region` + `TourDetails` только
  ради счётчика дней; без `TourDay` и графа дня). Общий `IncludeTourGraph()` не изменён (D-7).
- `ATTours.ClientAPI/Controllers/TourInitializationController.cs` — оба клиентских метода
  переведены на `TourClientInfo` + резолв (in place, D-12). `GetToursClient` теперь возвращает
  `List<TourCardModel>` (было `List<TourInfoModel>`), фильтр `IsActive && !IsArchived` + `?region=`
  сохранён дословно. `GetTourInfo` остался `TourInfoModel`, но значения резолвнуты; not-found-фильтр
  (черновик/архив = 404 `TourNotFound`) сохранён дословно. Удалён ставший неиспользуемым
  `using ATTours.Common.Extensions;`.
- `ATTours.ClientAPI/Mapper/MappingProfile.cs` — блок `Tour → TourCardModel` (перед секцией
  TOURDAY). Переиспользует существующие мапперы `TourInfoTranslation → TranslatableInfoModel` и
  `TourRegion → TourRegionInfoModel`. Резолв override в маппере НЕ делается (D-9/3.4.4).

#### Поля `TourCardModel` и чем обоснованы

`{ int Id; TourType Type; decimal? TotalPrice; string MainImageUrl; int DurationDays;
List<TranslatableInfoModel> Translations; List<TourRegionInfoModel> Regions }`.

Сверено с реальной карточкой `Frontend/src/shared/ui/TourCard.tsx`, что она рисует:
- `Id` — навигация на детальную (`GET GetTourInfo?id=`);
- `Type` — чип тур/экскурсия + расчёт ночей на фронте (`formatDuration`);
- `TotalPrice` — «цена от» (`priceFrom`);
- `MainImageUrl` — обложка (`coverImage`);
- `DurationDays` = `TourDetails.Count` — длительность (`formatDuration(durationDays, …)`);
- `Translations` (одна локаль, тур-уровень) — `title` + `shortDescription`, различаются по
  `Type` (`TourTranslationType.Title`/`ShortDescription`), как в `TourInfoModel`. Формат оставлен
  списком переводов (а не плоскими `Title`/`ShortDescription`) для консистентности с остальным
  контрактом и переиспользования существующего маппера/фильтра языка;
- `Regions` — плоские слаги (`regionSlugs`), как `TourInfoModel.Regions`.

**Самостоятельные микрорешения:**
1. **`Slug` в карточку НЕ добавлен.** Сущность `Tour` не имеет `Slug` (у фронта `slug` — моковое
   поле), добавление потребовало бы миграции — вне скоупа 3.5. Публичная детальная адресуется по
   `id` (`GetTourInfo?id=`), интеграция этапа 5 пойдёт по `id`. Не выдумывал несуществующее поле.
2. **`rating`/`reviewCount`/`badges` карточки НЕ добавлены** — их нет в доменной модели бэка
   (фронтовые моки). Не выдумывал.
3. **`DurationNights` не заведён** — выводим на фронте (`Type == Excursion ? 0 : days − 1`), в БД
   не хранится, дублировать полем не стал.
4. **Форма ответа детальной — прежний `TourInfoModel` (D-9=A).** Резолв реализован как замена
   `Translations` каталог-привязанной строки на ОДНУ строку с эффективным значением
   `own(lang) ?? template(lang)`; при `null` — пустой список (честное «не заполнено»).
   Синтезированная строка не несёт исходного `Id` перевода — публичной проекции он не нужен.
   Тип перевода у синтезированной строки: `RoutePoint`/`TourNote` — своего `Type` не имеют;
   `AdditionalExpense` — `ExpenseTranslationType.Desciption` (единственное значение). Все три
   в маппере всё равно дают `Type → 0`, поведение консистентно.
5. **Порядок в `ResolveDetail`: сначала `ExtractWithNeededLanguage` (Common-фильтр по всему
   графу), затем резолв каталог-строк.** Эквивалентно «сначала резолв, потом язык» из §3.5.2:
   фильтр удаляет лишь own-строки чужих языков, а резолвер и так смотрит только строку
   запрошенного языка. Для строк с `FK == null` остаётся прежнее поведение (own, отфильтрованные
   по языку) — публичный контракт для них не меняется.
6. **`ProjectCards` НЕ зовёт `ExtractWithNeededLanguage(Tour)`.** Та обходит `tourDetail.TourDay`,
   которого в облегчённом card-графе нет (был бы NRE). Вместо этого фильтрует только
   тур-уровневые `Translations` по языку. Это Service-шаг, `LanguageExtensions` не расширялся.
7. **Резолвит на лету над NoTracking-графом (D-10)** — в БД ничего не пишется. `CatalogOverrideResolver`
   вызывается с селекторами `t => ((int)t.LanguageCode, t.Value)`; шаблонная сторона —
   `X?.Translations ?? []` (гард от NRE и от CS8604 в nullable-enable Service).

#### Проверки

- **`dotnet build ATTours.slnx --no-incremental`** → `Build succeeded. 30 Warning(s). 0 Error(s).`
  Набор предупреждений идентичен базовому (NU1903 + CS86xx/CS0168/CS8625 в предсуществующем коде);
  **ни одного предупреждения в новых/изменённых файлах 3.5** (проверено по выводу сборки — нет
  строк с `TourCardModel`/`TourClientInfo`/`TourOverrideProjection`/`TourGraphQueryExtensions`/
  `MappingProfile`/`TourInitializationController`).
- **Миграций нет:** `dotnet ef migrations has-pending-model-changes` →
  `No changes have been made to the model since the last migration.` Модель не тронута, как и
  требовалось (новых сущностей/полей БД в 3.5 нет).
- **`dotnet ef migrations add` / `database update` НЕ запускались.** Ручной прогон эндпоинтов
  (Swagger/.http) с реальной БД НЕ делался — зона `backend-tester`.

#### Что осталось `backend-tester`

- Прогнать вживую `GET GetToursClient?languageCode=&region=` — проверить форму `TourCardModel`
  (в т.ч. `DurationDays`, слаги `Regions`, одна локаль в `Translations`), что список остаётся
  фильтрованным `IsActive && !IsArchived` + `?region=`, неизвестный slug → пустой список.
- Прогнать `GET GetTourInfo?id=&languageCode=` на туре с каталог-привязанными
  точками/расходами/заметками БЕЗ собственного перевода на язык — убедиться, что теперь приходит
  текст шаблона (`own(lang) ?? template(lang)`), а не пустой список (это и есть фикс бага 3.5.1).
  Проверить приоритет own над template, когда own есть; поведение `null → []`.
- Проверить not-found-фильтр детальной (черновик/архив/несуществующий id = 404 `TourNotFound`).
- Валидность конфигурации AutoMapper для `Tour → TourCardModel` в рантайме.

---

### 2026-07-31 — backend-code-reviewer, ревью 3.4/3.5 (техдолг, ничего не блокирует)

Проверка архитектуры/конвенций (без БД). Блокирующих нарушений слоёв нет — оба пункта легли
корректно. Давид решил: не чинить сейчас, всё зафиксировать как техдолг, переходить к этапу 4.

**Развилка D-9 vs D-13 (не баг, требует признания, а не фикса).** Публичная детальная
(`GetTourInfo` → `TourInfoModel`, D-9 = одна DTO) утекает админскими полями (`isActive`, `placeId`,
`expenseTemplateId` и т.д.), хотя D-13 предполагал не выносить сырой `PlaceId` наружу. Архитектор
называл это ценой варианта A. Давид: **пока пропустить, оставить как есть, зафиксировать в
техдолге** (не заводить отдельную скрывающую проекцию сейчас).

**F1 (medium).** Reconcile-алгоритм скопипащен 3 раза (`PlaceUpdateService`/
`ExpenseTemplateUpdateService`/`TourNoteTemplateUpdateService`) вместо переиспользования generic
`TourUpdateService.ReconcileCollection<T>` — и есть расхождение поведения: копии молча игнорируют
неизвестный `Id`, оригинал бросает `InvalidEntityIds`.

**F2 (medium).** Правило «что видит публика» (`IsActive && !IsArchived`) размазано по контроллеру
и `RegionInfo`, хотя 3.5 завёл `TourClientInfo` как естественное место для него.

**F3 (medium).** `TourOverrideProjection.ProjectCards` копирует логику фильтра языка из
`Common/LanguageExtensions` вместо новой перегрузки там же.

**F4 (low).** `TourClientInfo` не переопределяет `GetEntityQueryableRepository()` — риск тихой
ловушки для будущих вызовов.

**F5 (low).** Тройной копипаст внутри `ResolveDetail`.

**F6 (low).** Два каталожных Validation-сервиса наследуют context-dependent базу, БД не трогая.

**F7 (low).** Два разных идиома доступа к «чужой» сущности.

**F8 (low).** Сортировка каталогов — в контроллере, в памяти, не по архитектурному документу §3.4.6.

**F9 (low).** ADR 004 по override-модели не написан.

**F10 (low).** Нет общего `ITranslation`-контракта — в бэклог.

**Статус: ничего из F1–F10 и развилки D-9/D-13 не исправлялось.** Все 10 пунктов + развилка —
техдолг на будущее, не блокируют переход к этапу 4 (админка).
