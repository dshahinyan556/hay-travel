# Этап 3 (бэк) — архитектурное решение по 3.1 / 3.2 / 3.3

Автор: `backend-architect`. Дата: 2026-07-29.
Статус: решение принято, реализацию делает `backend-developer`.

Входные документы: `backend-stage3-sync.md` (замороженные решения),
`big-update-2026-07.md` §5 (аудит, повторно не проводился), `audit/backend-gap-analysis.md`,
`backend-api.md`, `product-model.md`.

**Здесь нет реализации** — только: где что живёт, контракты между слоями, имена файлов
и классов, порядок миграций, что ломается в API, развилки для Давида.

Блокеры 3.0 (фильтр `IsActive`/`IsArchived` в `GetToursClient` и строка подключения)
делает параллельно `backend-developer` — в этом документе они не решаются, но
в 3.2 есть точка стыковки (см. §3.2.8).

---

## 0. Общие правила, действующие на все три пункта

Взяты из фактического кода, а не придуманы. Отклонения от них помечены явно.

| Правило | Как в проекте сейчас |
| --- | --- |
| Сущность | `ATTours.Common/Entities/*.cs`, наследует `EntityBase` (`int Id`), конфигурация подключается атрибутом `[EntityTypeConfiguration(typeof(XxxConfiguration))]` |
| EF-конфигурация | `ATTours.Common/Infrastructure/EntityConfiguration/XxxConfiguration.cs`, `builder.ToTable(nameof(Xxx))` |
| DbSet | `ATTours.DataLayer/ATToursContext.cs` |
| DTO | `ATTours.Common/DTO/Init/` (id-less, на создание), `DTO/Info/` (с Id, на чтение и update), `DTO/Request/` (мелкие команды). Папки `DTO/Base` и `DTO/Create` пустые — не использовать |
| Репозиторий | Конкретных репозиториев нет и не нужно. Generic `EntityRepository<TEntity>` через `RepositoryCoreBase<TEntity, ATToursContextFactory>` |
| Сервис чтения | `ATTours.Service/Services/InfoServices/`, наследует `EntityInfoBase<TEntity>`, граф `Include` — переопределением `GetEntityQueryableRepository()` |
| Сервис создания | `Services/CreateServices/`, наследует `CreateVerifiableEntityBase<TEntity, ATToursContextFactory>` |
| Сервис изменения | `Services/UpdateServices/`, наследует `EntityActionServiceBase<TEntity, ATToursContextFactory>` (сложный reconcile) либо напрямую `RepositoryCoreBase` (точечный патч, как `TourActivationService`) |
| Валидация | `Services/ValidationServices/`, наследует `EntityValidationBase<TEntity>` (без БД) или `EntityValidationContextDependentBase<TEntity, TContextFactory>` (с БД) |
| Ошибки | `throw new ErrorModelException(GlobalErrorCode.X, HttpStatusCode.Y, msg)`. Новый код — член enum `ATTours.Helper/Enums/GlobalErrorCode`. Новая цепочка обработчиков **не нужна** |
| Контроллер | `ATTours.ClientAPI/Controllers/`, `[ApiController]` + `[Route("api/[controller]")]`, методы — `[HttpGet]` + отдельный `[Route("Имя")]`. Сервисы создаются через `new` + `using` (замороженное решение, не переигрываем) |
| Маппинг | Один файл `ATTours.ClientAPI/Mapper/MappingProfile.cs` |
| Мультиязычность | Отдельная таблица `*Translation` c `LanguageCode` + `Value`. Фильтрация языка — постобработкой в памяти, `ATTours.Common/Extensions/LanguageExtensions.cs` |
| Enum на проводе | Числа, не строки |

Ловушки, которые уже есть в коде и о которые споткнётся разработчик:

- Namespace слоя Service — `ATTours.BusinessServices.*` (не `ATTours.Service`).
- `ATToursContextFactory` лежит в namespace `ArmeniaTours.DataLayer`, а `ATToursContext` — в `ATTours.DataLayer`.
- `TourCreateModel` лежит в namespace `ATTours.Common.Dto.Init` (строчное `Dto`), остальные Init-модели — в `ATTours.Common.DTO.Init`.
- Навигации объявлены как `HashSet<>`, поэтому в `Include` лямбда приводится к
  `(Expression<Func<TOwner, ICollection<TChild>>>)` — иначе `ThenInclude` видит `HashSet<>`.
  Это уже сделано в `TourGraphQueryExtensions`, повторить для новых веток.

### Мультиязычность: правило «третий язык должен быть дешёвым»

Сейчас `LanguageCode { Russian = 1, English = 2 }`. Ни одна новая сущность этого этапа
**не должна** содержать колонок вида `TitleRu` / `TitleEn`. Добавление третьего языка
обязано сводиться к: `LanguageCode.Armenian = 3` + контент. Проверочный критерий для
каждой новой сущности ниже соблюдён.

Дополнительно в 3.1 введён механизм деградации: если перевода на язык нет, отдаётся
язык-нейтральное `Value`. Это делает добавление языка не только дешёвым, но и
безопасным (сайт не отдаёт `null` в hero, пока переводы не заполнены).

---

## 3.1 SiteSettings — настройки сайта

### 3.1.1 Ключевое решение: метаданные ключа живут в коде, БД хранит только значение

Замороженное требование — «новая настройка не требует миграции». Из трёх механизмов
(`HasData` → требует миграцию; runtime-seed на старте → в проекте нет ни одного
startup-хука, `MigrationExtensions.MigrateDatabase` не вызывается нигде; каталог в коде)
выбран **каталог в коде**.

- **Каталог** (`SiteSettingCatalog`) — список определений: `Key`, `Group`, `ValueType`,
  `IsTranslatable`, `IsPublic`, `SortOrder`, `DefaultValue`, `DefaultTranslations`.
  Добавить настройку = добавить одну строку в этот файл. Ни миграции, ни сида.
- **БД** (`SiteSetting` + `SiteSettingTranslation`) хранит **только то, что admin ввёл**:
  `Key` + `Value` + переводы. Метаданных в БД нет.
- **Слияние** «каталог ⟵ БД» делает Info-сервис. Ключ, которого нет в БД, возвращается
  со значением из каталога и `Id = 0`.

Почему не колонки `IsPublic` / `ValueType` в БД: они никем не редактируются, а значит
станут вторым источником правды, который разъедется с кодом. Отдельно про `IsPublic` —
это свойство безопасности: случайный тумблер в админке не должен уметь опубликовать
приватный ключ. Ревью такого изменения должно происходить в коде.

**Цена решения:** добавление настройки требует деплоя бэка (но не миграции). Для набора
«hero / контакты / соцсети / логотип / SEO» это нормально: фронт всё равно обязан знать
ключ, чтобы его отрисовать. → Развилка **D-1** для Давида (§7).

### 3.1.2 Типизация значения

Все значения — **строки** (`nvarchar(4000)`). `SettingValueType` — подсказка для
рендера контрола в админке и для валидации, не тип хранения. Значения enum:
`Text = 1`, `MultilineText = 2`, `Url = 3`, `ImageUrl = 4`. Телефон и email — `Text`.
Числовых и булевых настроек в этом наборе нет; если появятся — добавляется член enum
(изменение кода, но не схемы).

### 3.1.3 Группы и именование ключей

- Ключ: `<группа>.<camelCase>`, например `hero.imageUrl`. Уникальный.
- Группа — enum `SiteSettingGroup { Hero = 1, Contacts = 2, Social = 3, Branding = 4, Seo = 5 }`,
  живёт **в каталоге, не в БД**. Инвариант: `Key` начинается с имени группы в нижнем
  регистре + точка. Каталог — один рукописный файл, инвариант держится ревью.
- «Группу одним запросом» фронт получает так: `GetPublic` отдаёт **все** публичные
  настройки одним объектом `{ "hero.imageUrl": "...", "hero.title": "..." }`
  (их ~17, это меньше килобайта), опциональный `?group=` сужает выборку.
  Вложенной структуры в БД нет и не нужно.

### 3.1.4 Стартовый каталог ключей

| Key | Group | ValueType | Translatable | Public |
| --- | --- | --- | --- | --- |
| `hero.imageUrl` | Hero | ImageUrl | нет | да |
| `hero.title` | Hero | Text | да | да |
| `hero.subtitle` | Hero | MultilineText | да | да |
| `hero.ctaLabel` | Hero | Text | да | да |
| `hero.ctaHref` | Hero | Url | нет | да |
| `branding.logoUrl` | Branding | ImageUrl | нет | да |
| `contacts.phone` | Contacts | Text | нет | да |
| `contacts.email` | Contacts | Text | нет | да |
| `contacts.address` | Contacts | Text | да | да |
| `contacts.workingHours` | Contacts | Text | да | да |
| `social.instagramUrl` | Social | Url | нет | да |
| `social.facebookUrl` | Social | Url | нет | да |
| `social.telegramUrl` | Social | Url | нет | да |
| `social.whatsappUrl` | Social | Url | нет | да |
| `social.youtubeUrl` | Social | Url | нет | да |
| `seo.siteTitle` | Seo | Text | да | да |
| `seo.metaDescription` | Seo | MultilineText | да | да |
| `seo.ogImageUrl` | Seo | ImageUrl | нет | да |

Честная оговорка: в стартовом наборе **все ключи публичные**, то есть `IsPublic` сегодня
ничего не отсекает. Флаг заведён по замороженному решению и работает на будущее
(например, ключ интеграции, который наружу отдавать нельзя).

Где живёт дефолт для отсутствующего ключа: `SiteSettingDefinition.DefaultValue` +
`DefaultTranslations`. `GetPublic` никогда не отдаёт `null` для известного ключа и
никогда не отвечает 404.

### 3.1.5 Слои и файлы

**Entity — `ATTours.Common/Entities/`**
```
SiteSetting : EntityBase
    string Key                                   // unique, 128
    string Value                                 // язык-нейтральное значение / fallback
    HashSet<SiteSettingTranslation> Translations

SiteSettingTranslation : EntityBase
    int SiteSettingId
    LanguageCode LanguageCode
    string Value
    SiteSetting SiteSetting
```
Поля `Type` у перевода нет — у настройки одно текстовое поле (как у `RestrictionTranslation`
и `RoutePointTranslation`). В `TranslatableInfoModel` маппер подставит константу `0`.

**Enums — `ATTours.Common/Enums/`:** `SettingValueType.cs`, `SiteSettingGroup.cs`.

**Каталог — `ATTours.Common/Infrastructure/SiteSettings/`:**
`SiteSettingDefinition.cs`, `SiteSettingCatalog.cs`.
```csharp
public static class SiteSettingCatalog
{
    public static IReadOnlyList<SiteSettingDefinition> All { get; }
    public static SiteSettingDefinition ByKey(string key);   // null, если ключ неизвестен
    public static bool IsKnown(string key);
}
```
Почему в `Common`, а не в `Service`: каталог нужен и слою Service (слияние), и
`MappingProfile` в `ClientAPI` (метаданные в Info-DTO). `Common` видят оба.
Почему не в `Common/Settings/`: там лежит конфиг приложения (`CommonSettings`,
`ApplicationSettingsBase`) — другое понятие, соседство путало бы.

**EF-конфигурации — `ATTours.Common/Infrastructure/EntityConfiguration/`:**
`SiteSettingConfiguration.cs` (`Key` required 128 + unique index; `Value` 4000, nullable;
`HasMany(Translations).WithOne(x => x.SiteSetting).HasForeignKey(x => x.SiteSettingId).OnDelete(Cascade)`),
`SiteSettingTranslationConfiguration.cs` (`Value` 4000, nullable).

`Value` **nullable** намеренно: незаполненная настройка — валидное состояние, а не ошибка.

**DbSet:** `SiteSettings`, `SiteSettingTranslations`.

**DTO — `ATTours.Common/DTO/`**
```
Info/SiteSettingInfoModel.cs
    int Id                    // 0 = ключ ещё не сохранён в БД
    string Key
    SiteSettingGroup Group    // из каталога
    SettingValueType ValueType
    bool IsTranslatable
    bool IsPublic
    int SortOrder
    string Value
    List<TranslatableInfoModel> Translations

Info/SiteSettingsPublicModel.cs
    int LanguageCode
    Dictionary<string, string> Values          // key -> разрешённое значение

Request/SiteSettingUpdateModel.cs
    string Key                                  // идентичность записи — Key, не Id
    string Value
    List<TranslatableCreateModel> Translations  // Type игнорируется
```

**Repository:** отдельного не нужно — `EntityRepository<SiteSetting>` из базы.

**Service — `ATTours.Service/Services/`**
```csharp
// InfoServices/SiteSettingsInfo.cs
public class SiteSettingsInfo : EntityInfoBase<SiteSetting>
{
    public SiteSettingsInfo();                                   // CommonSettings.Instance.ATToursConnectionString
    public SiteSettingsInfo(string connectionString, CancellationToken ct = default);
    public SiteSettingsInfo(IApplicationDbContext context, CancellationToken ct = default);

    protected override IEntityQueryableRepository<SiteSetting> GetEntityQueryableRepository();
    // base + .Include(x => x.Translations)

    // Полный список: каталог, поверх которого наложены сохранённые значения.
    // Ключи, которых нет в БД, возвращаются с Id = 0 и дефолтами каталога.
    public Task<List<SiteSetting>> GetMergedAsync();

    // Публичное чтение: только IsPublic, одна локаль, перевод ?? Value.
    public Task<Dictionary<string, string>> GetPublicAsync(int languageCode, SiteSettingGroup? group = null);
}

// UpdateServices/SiteSettingsUpdateService.cs
public class SiteSettingsUpdateService : EntityActionServiceBase<SiteSetting, ATToursContextFactory>
{
    public SiteSettingsUpdateService(List<SiteSetting> entities, CancellationToken ct = default);
    public Task<List<SiteSetting>> UpsertAsync();   // upsert по Key, возвращает слитый список
}

// ValidationServices/SiteSettingsValidationService.cs
internal class SiteSettingsValidationService : EntityValidationBase<SiteSetting>
```

Правило разрешения значения (**живёт в Service, не в репозитории и не в БД**):
`Translations.FirstOrDefault(t => t.LanguageCode == lang)?.Value ?? entity.Value ?? definition.DefaultValue`.

Правило upsert: идентичность записи — **`Key`**, не `Id` (у несохранённого ключа `Id = 0`).
Переводы внутри настройки сверяются **по `LanguageCode`**, а не по `Id` — у настройки
не больше одной строки на язык, и админка не отслеживает id несохранённых ключей.
Это осознанное отличие от reconcile-по-Id в графе тура; в остальном граф тура не трогается.

Валидация: неизвестный `Key` → `400 GlobalErrorCode.SiteSettingKeyUnknown`. Это следствие
каталога в коде: админка не может завести произвольный ключ. Формат URL не валидируется
(в проекте `RegexSettings`/`RegexHelper` есть, но к URL нигде не применяются — новое
правило сюда не вводим).

**Controller — `ATTours.ClientAPI/Controllers/SiteSettingsController.cs`**
Класс `SiteSettingsController(IMapper mapper) : Controller`, маршрут `api/SiteSettings`.
Имя файла = имени класса (в отличие от `TourInitializationController.cs` / `TourController`
— эту рассинхронизацию не тиражируем).

| Метод | Route | Вход | Возврат |
| --- | --- | --- | --- |
| GET | `api/SiteSettings/GetPublic` | `languageCode`, `group?` | `SiteSettingsPublicModel` |
| GET | `api/SiteSettings/GetAll` | — | `List<SiteSettingInfoModel>` (оба языка) |
| PUT | `api/SiteSettings/Update` | `List<SiteSettingUpdateModel>` | `List<SiteSettingInfoModel>` |

Отдельного `Init` нет намеренно: `GetAll` уже возвращает полный каталог с дефолтами и
играет роль init-скелета (аналог `InitTour`).

**Mapper — блоки в `MappingProfile.cs`:**
`SiteSetting → SiteSettingInfoModel` (метаданные заполняются из `SiteSettingCatalog.ByKey(src.Key)`
в `AfterMap`), `SiteSettingTranslation → TranslatableInfoModel` (`Type → 0`),
`SiteSettingUpdateModel → SiteSetting`, `TranslatableCreateModel → SiteSettingTranslation`.

Обращение маппера к статическому каталогу — осознанное исключение из «маппер только
перекладывает поля». Каталог — константа времени компиляции, без DI и без состояния.

**Код ошибки:** `GlobalErrorCode.SiteSettingKeyUnknown = 2005`.

### 3.1.6 Миграция

`AddSiteSettings` — две таблицы, unique index на `SiteSetting.Key`. **Без `HasData`.**

### 3.1.7 Что ломается в существующем API

**Ничего.** Только новый контроллер. Админка до этапа 4.1 ничего не заметит.

### 3.1.8 Мультиязычность

Третий язык: `LanguageCode.Armenian = 3` + строки переводов. Схема не меняется.
Пока армянского перевода нет — `GetPublic?languageCode=3` отдаст `Value` (RU-текст),
а не `null`. Сайт не ломается.

---

## 3.2 Region — регионы и связь с туром

### 3.2.1 Сущности

```
Region : EntityBase
    string Slug                                 // unique, 64 — совпадает с RegionSlug на фронте
    int SortOrder
    HashSet<RegionTranslation> Translations
    HashSet<TourRegion> TourRegions

RegionTranslation : EntityBase
    int RegionId
    RegionTranslationType Type                  // Name = 1, Blurb = 2
    LanguageCode LanguageCode
    string Value
    Region Region

TourRegion : EntityBase                         // join СО СВОИМ Id (замороженное решение)
    int TourId
    int RegionId
    int SortOrder
    Tour Tour
    Region Region
```
`Tour` дополняется `public HashSet<TourRegion> TourRegions { get; set; } = [];`

Почему `Type` у перевода региона есть (в отличие от `RestrictionTranslation`): у региона
уже сегодня два текста — название и `blurb` («Каскад, Вернисаж, площадь Республики»),
и `blurb` реально показывается в UI карты. Сидим только `Name`; `blurb` остаётся пока
на фронте и может быть перенесён в БД позже **без миграции**. Это не задел под
гипотетику — поле существует в продукте сегодня.

Почему у `TourRegion` свой `Id`: замороженное решение. Практическая причина —
`ReconcileCollection<T> where T : IEntity` в `TourUpdateService` работает только с
сущностями со своим `Id`; композитный ключ `TourDetail` заставил написать отдельный
`ReconcileTourDays` на ~55 строк. С `TourRegion` это один вызов.

### 3.2.2 EF-конфигурации

`RegionConfiguration` — `Slug` required 64 + **unique index**; `HasMany(Translations)`
→ `Cascade`.
`RegionTranslationConfiguration` — `Value` required 400.
`TourRegionConfiguration` — `HasOne(Tour).WithMany(TourRegions).HasForeignKey(TourId).OnDelete(Cascade)`;
`HasOne(Region).WithMany(TourRegions).HasForeignKey(RegionId).OnDelete(Restrict)`;
**unique index `(TourId, RegionId)`**.

`Restrict` со стороны региона — намеренно: регион нельзя удалить, пока он привязан к турам.
Каскадный путь один (от `Tour`), множественных каскадов SQL Server здесь не возникает.

`TourDeletionService` менять **не нужно**: `TourRegion` уходит каскадом от тура, как
`Restriction` сегодня. Явного удаления, как у `TourDay`, не требуется — у `TourRegion`
есть FK на тур.

**DbSet:** `Regions`, `RegionTranslations`, `TourRegions`.

### 3.2.3 Сид 11 регионов: raw SQL в миграции, не `HasData`

В проекте нет ни одного `HasData` — вводить его сюда не будем. Прецедент рукописного
SQL в миграции есть (`AddRoutePoint` содержит `DELETE FROM TourDayInfoTranslation WHERE Type = 5`).

Почему не `HasData`: он вшивает конкретные `Id` в model snapshot и делает сид частью
модели. Названия регионов редактируемы через переводы (сегодня — вручную, позже — через
админку), и любое их изменение в БД будет расходиться со снимком, а следующая миграция
начнёт «чинить» строки обратно. Для одноразового справочника из 11 строк это
неоправданная связанность.

Механика (в отдельной миграции `SeedArmenianRegions`, `migrationBuilder.Sql`):
1. `INSERT INTO Region (Slug, SortOrder) VALUES ('yerevan', 0), ...` — без явных `Id`.
2. Переводы вставляются `SELECT`-ом из `Region` с `JOIN` по `Slug` (`CASE Slug WHEN ... END`),
   поэтому `SET IDENTITY_INSERT` и хардкод `Id` не нужны.
3. `Down()` — `DELETE FROM RegionTranslation WHERE RegionId IN (SELECT Id FROM Region WHERE Slug IN (...))`,
   затем `DELETE FROM Region WHERE Slug IN (...)`.

Данные — дословно из `Frontend/src/shared/data/armeniaRegions.ts` (поле `hy` оттуда
удалено намеренно, армянский не заводим). `SortOrder` = индекс в массиве фронта,
чтобы порядок в списках совпадал:

| SortOrder | Slug | RU | EN |
| --- | --- | --- | --- |
| 0 | `yerevan` | Ереван | Yerevan |
| 1 | `aragatsotn` | Арагацотн | Aragatsotn |
| 2 | `ararat` | Арарат | Ararat |
| 3 | `armavir` | Армавир | Armavir |
| 4 | `gegharkunik` | Гегаркуник | Gegharkunik |
| 5 | `kotayk` | Котайк | Kotayk |
| 6 | `lori` | Лори | Lori |
| 7 | `shirak` | Ширак | Shirak |
| 8 | `syunik` | Сюник | Syunik |
| 9 | `vayots-dzor` | Вайоц-Дзор | Vayots Dzor |
| 10 | `tavush` | Тавуш | Tavush |

SVG-геометрия и `labelAt` в БД **не переносятся** — замороженное решение, это ассет
отрисовки.

### 3.2.4 Нужен ли регион у точки маршрута

**Нет.** Обоснование:
1. `RoutePoint` сегодня — упорядоченная текстовая подпись внутри дня, без координат;
   поставить её на карту всё равно нельзя.
2. Фильтр «туры региона» полностью обслуживается `TourRegion` — регион у точки для него
   не нужен.
3. Этап 3.4 вводит каталог `Place` (slug + `RegionId` + координаты + фото) — вот он и
   есть правильный владелец географии точки. `RoutePoint.RegionId`, добавленный сейчас,
   через неделю станет вторым, конфликтующим источником географии.

### 3.2.5 DTO

```
Info/RegionInfoModel.cs
    int Id
    string Slug
    int SortOrder
    int TourCount                                // публикуемых туров в регионе
    List<TranslatableInfoModel> Translations

Info/TourRegionInfoModel.cs                      // плоская проекция для графа тура
    int Id                                       // Id строки связи
    int RegionId
    string Slug                                  // денормализовано, чтобы не тянуть регион с переводами
    int SortOrder

Init/TourRegionCreateModel.cs
    int RegionId
    int SortOrder
```
`TourInfoModel` += `List<TourRegionInfoModel> Regions`.
`TourCreateModel` += `List<TourRegionCreateModel> Regions`.

Почему плоско, без вложенного региона с переводами: публичный тип фронта уже устроен
именно так — `shared/types/tour.ts` содержит `regionSlugs: readonly RegionSlug[]`.
Названия регионов фронт берёт из одного запроса к `RegionController`, а не из каждого тура.
Граф тура при этом растёт на один `ThenInclude`, а не на два.

### 3.2.6 Service

```csharp
// ATTours.Service/Services/InfoServices/RegionInfo.cs
public class RegionInfo : EntityInfoBase<Region>
{
    public RegionInfo();
    public RegionInfo(string connectionString, CancellationToken ct = default);
    public RegionInfo(IApplicationDbContext context, CancellationToken ct = default);

    protected override IEntityQueryableRepository<Region> GetEntityQueryableRepository();
    // base + .Include(x => x.Translations), + OrderBy(SortOrder) на уровне контроллера/маппера

    // RegionId -> количество туров, видимых на публичном сайте (IsActive && !IsArchived).
    // Считается проекцией в SQL, не в памяти.
    public Task<Dictionary<int, int>> GetPublicTourCountsAsync();
}
```
Счётчик отдаётся `Dictionary<int,int>`, а не DTO: сервис не должен возвращать модель
контракта, а заводить промежуточный класс ради двух `int` — лишняя сущность. Контроллер
сшивает `RegionInfoModel[]` со словарём. Две дешёвые выборки по крошечным таблицам;
`IQueryableRepository<T>.Select<TResult>` в абстракции есть, отдельный репозиторий не нужен.

**`TourGraphQueryExtensions.IncludeTourGraph()`** дополняется одной веткой:
```
.Include((Expression<Func<Tour, ICollection<TourRegion>>>)(x => x.TourRegions))
    .ThenInclude(tr => tr.Region)
```
Переводы региона в граф тура **не включаются** (см. 3.2.5).

**`TourUpdateService`** — один новый вызов рядом с существующими:
```
ReconcileCollection(existing.TourRegions, incoming.TourRegions,
    (t, s) => { t.RegionId = s.RegionId; t.SortOrder = s.SortOrder; });
```
С оговоркой про `null` — см. §3.2.9.

**`TourValidationService`** меняет базовый класс:
`EntityValidationBase<Tour>` → `EntityValidationContextDependentBase<Tour, ATToursContextFactory>`.
Причина: проверка «такой `RegionId` существует» требует БД. Этот базовый класс в проекте
уже есть и сейчас не используется ни одной валидацией — это ровно его случай.
Оба вызывающих (`TourCreationService.GetEntityValidation()` и `TourUpdateService`)
передают свой `Context` (`protected` в `CoreBase`), поэтому лишнего подключения не возникает.

Новые правила валидации тура:
- `RegionId` в `TourRegions` не повторяются (в памяти) — иначе непонятная ошибка
  unique index;
- все `RegionId` существуют → иначе `400 GlobalErrorCode.RegionNotFound`.
  Без этой проверки было бы SQL-нарушение FK и невнятный ответ из
  `MsSqlContextExceptionHandlerChain`.

**`LanguageExtensions`** дополняется перегрузками для региона:
`ExtractWithNeededLanguage(this Region region, int languageCode)` и коллекционной.
Граф тура не затрагивается — переводы региона в нём не едут.

### 3.2.7 Controller

`ATTours.ClientAPI/Controllers/RegionController.cs`, класс `RegionController(IMapper mapper)`,
маршрут `api/Region`, текущий стиль (`new RegionInfo()` + `using`).

| Метод | Route | Вход | Возврат |
| --- | --- | --- | --- |
| GET | `api/Region/GetAll` | — | `List<RegionInfoModel>` (оба языка, с `TourCount`) |
| GET | `api/Region/GetRegionsClient` | `languageCode` | `List<RegionInfoModel>` (одна локаль, с `TourCount`) |

Имена зеркалят `Tour`: админский `GetAll` и публичный `...Client`. CRUD регионов
в этап 3.2 **не входит** — данные приходят сидом; вкладка «Регионы» в справочниках
(чек-лист 4.2) делается вместе с 3.4 по общему паттерну каталогов.

`TourCount` считается по правилу публичной витрины (`IsActive && !IsArchived`) в обоих
эндпоинтах — иначе плашка «Регион · N туров» на карте врала бы.

### 3.2.8 Фильтр туров `?region=`

Точка стыковки с 3.0 — тот же метод `GetToursClient`. Финальный предикат:

```csharp
// база — то, что кладёт 3.0
Expression<Func<Tour, bool>> where = x => x.IsActive && !x.IsArchived;

// с фильтром по региону — дополнительный && , отдельным литералом
if (!string.IsNullOrWhiteSpace(region))
    where = x => x.IsActive && !x.IsArchived
              && x.TourRegions.Any(tr => tr.Region.Slug == region);

var result = await info.GetAllAsync(where);
```
Новый метод в `TourInfo` **не нужен** — базовый `EntityInfoBase.GetAllAsync(where)` уже
принимает предикат, как это делают `GetAll`/`GetArchived`. Predicate-builder в проект
не вводим: два литеральных выражения читаются лучше.

Параметр — **slug**, а не `Id`: URL фронта и карта уже работают со слагами
(`/trips?region=syunik`), а `Id` из сида — деталь БД.

Неизвестный slug → **пустой список**, не 400. Публичный эндпоинт получает параметр из
адресной строки, которую правит пользователь; правильная реакция — «туров не найдено»,
а не страница ошибки. Валидный перечень слагов фронт берёт из `RegionController`.

`GetTourInfo` не меняется.

### 3.2.9 Что ломается в существующем API

Формально — ничего: в ответы добавляется поле `regions`, в запросы — опциональное.
Фронт игнорирует неизвестные поля, `AllowNullCollections = true` уже включён.

Но есть одна реальная ловушка, и она закрывается контрактом:

> `UpdateTour`: `Regions == null` (поле отсутствует) означает **«не трогать регионы»**;
> `Regions == []` означает **«очистить все»**.

Без этого правила админка, которая до этапа 4.4 не умеет присылать `regions`, при первом
же сохранении тура стирала бы регионы, проставленные вручную. Это осознанное отличие от
остальных коллекций графа (там `null` трактуется как пустой список) — отличие
задокументировано здесь и должно быть повторено в `backend-api.md`.

### 3.2.10 Миграции

1. `AddRegionAndTourRegion` — 3 таблицы, unique index на `Region.Slug` и на `(TourId, RegionId)`.
2. `SeedArmenianRegions` — только данные, raw SQL.

Разделены намеренно: схема и данные откатываются независимо, и упавший сид не блокирует схему.

### 3.2.11 Мультиязычность

Третий язык — строки в `RegionTranslation`. Схема не меняется. Названия регионов
не хранятся колонками и не дублируются в турах (в туре только `Slug`).

---

## 3.3 Слияние `Restriction` + `OrganizationalDetail` → `TourNote`

### 3.3.1 Имена

Сущность — **`TourNote`**, переводы — **`TourNoteTranslation`**, дискриминатор —
**`TourNoteType { OrganizationalDetail = 1, Restriction = 2 }`**.

Имя `TourNote` уже зафиксировано в чек-листе этапа 3 (`3.3 ... -> TourNote(Type)`) и в
плане 3.4 (`TourNoteTemplate`) — не изобретаем новое. Порядок значений enum соответствует
порядку вкладок в форме тура (сначала орг. детали, потом ограничения). Enum едет числом,
как все enum проекта.

### 3.3.2 Форма перехода: новая таблица + перенос, не переименование

Отвергнуто: переименовать `Restriction` → `TourNote`, добавить `Type` и влить в неё
`OrganizationalDetail`.

Причина: переименование тянет за собой цепочку из 4 объектов — таблица `Restriction`,
таблица `RestrictionTranslation`, FK-колонка `RestrictionId` → `TourNoteId`, имена
индексов и constraint'ов. Это именно тот сценарий, где EF-скаффолдер регулярно
генерирует `Drop`+`Create` вместо `Rename`, то есть молча теряет данные. Плюс
результат асимметричен: `Id` ограничений выживают, `Id` орг. деталей переназначаются.

Принято: создать чистые `TourNote` / `TourNoteTranslation`, перелить обе стороны, удалить
четыре старых таблицы. Объём данных — единицы строк на тур; читаемость и проверяемость
миграции важнее экономии.

### 3.3.3 Миграция данных

Одна миграция `MergeRestrictionAndOrganizationalDetailIntoTourNote`:

1. Создать `TourNote` (+ временные колонки `LegacyId INT NULL`, `LegacySource TINYINT NULL`)
   и `TourNoteTranslation`.
2. `INSERT INTO TourNote (TourId, Type, SortOrder, LegacyId, LegacySource)`
   — `SELECT TourId, 1, SortOrder, Id, 1 FROM OrganizationalDetail`,
   затем то же из `Restriction` с `Type = 2`, `LegacySource = 2`.
3. `INSERT INTO TourNoteTranslation (TourNoteId, LanguageCode, Value)` — `JOIN` старых
   таблиц переводов с `TourNote` по `(LegacyId, LegacySource)`.
4. `DROP` временных колонок.
5. `DROP TABLE RestrictionTranslation, Restriction, OrganizationalDetailTranslation, OrganizationalDetail`.

Временные колонки вместо `OUTPUT`/`MERGE` — чтобы миграция читалась глазами и работала
одним батчем без табличных переменных.

`Down()` — обратная операция по `Type`. Возможен, но `Id` не восстанавливаются
(и не должны): откат допустим только до того, как админка сохранит хоть один тур.

**Порядок сортировки внутри типа.** `SortOrder` переносится как есть, отдельно для каждого
типа. Следствие: после слияния у тура два независимых диапазона `0..n-1` — свой у орг.
деталей, свой у ограничений. Глобальной сортировки по туру нет и не должно быть: в UI
это два самостоятельных списка. Правило для чтения — **всегда `Where(Type == X).OrderBy(SortOrder)`**,
никогда `OrderBy(SortOrder)` по всем заметкам сразу. Индекс — `HasIndex(x => new { x.TourId, x.Type })`.

### 3.3.4 Слои и файлы

**Удаляются:**
`Entities/Restriction.cs`, `RestrictionTranslation.cs`, `OrganizationalDetail.cs`,
`OrganizationalDetailTranslation.cs`;
`EntityConfiguration/RestrictionConfiguration.cs`, `RestrictionTranslationConfiguration.cs`,
`OrganizationalDetailConfiguration.cs`, `OrganizationalDetailTranslationConfiguration.cs`;
`DTO/Info/RestrictionInfoModel.cs`, `OrganizationalDetailInfoModel.cs`;
`DTO/Init/RestrictionCreateModel.cs`, `OrganizationalDetailCreateModel.cs`.

**Добавляются:**
```
Common/Entities/TourNote.cs
    int TourId
    TourNoteType Type
    int SortOrder
    Tour Tour
    HashSet<TourNoteTranslation> Translations

Common/Entities/TourNoteTranslation.cs
    int TourNoteId
    LanguageCode LanguageCode
    string Value
    TourNote TourNote

Common/Enums/TourNoteType.cs
Common/Infrastructure/EntityConfiguration/TourNoteConfiguration.cs
Common/Infrastructure/EntityConfiguration/TourNoteTranslationConfiguration.cs
Common/DTO/Info/TourNoteInfoModel.cs   { int Id; TourNoteType Type; int SortOrder; List<TranslatableInfoModel> Translations; }
Common/DTO/Init/TourNoteCreateModel.cs { TourNoteType Type; int SortOrder; List<TranslatableCreateModel> Translations; }
```
У перевода `Type` нет (одно текстовое поле) — как было у `RestrictionTranslation`.

**`Tour`:** `OrganizationalDetails` и `Restrictions` → одна `HashSet<TourNote> Notes = []`.
**`TourConfiguration`:** два `HasMany` → один.
**`ATToursContext`:** 4 `DbSet` → 2 (`TourNotes`, `TourNoteTranslations`).

**`TourInfoModel` / `TourCreateModel`:** `OrganizationalDetails` + `Restrictions` → `Notes`.

**Service:**
- `TourGraphQueryExtensions` — два `Include(...).ThenInclude(Translations)` → один по `Notes`.
- `TourUpdateService` — два блока `ReconcileCollection` → один:
  `(t, s) => { t.Type = s.Type; t.SortOrder = s.SortOrder; ReconcileCollection(t.Translations, s.Translations, ...); }`.
- `TourInitializationService` — `OrganizationalDetails = []` и `Restrictions = []`
  → `Notes = new List<TourNoteCreateModel>()`.
- `TourDeletionService` — без изменений (`TourNote` каскадит от тура, как каскадил `Restriction`).
- `LanguageExtensions.ExtractWithNeededLanguage` — два цикла → один по `tour.Notes`.

**Mapper:** ~8 блоков (`OrganizationalDetail*` ×3, `Restriction*` ×3, два блока переводов ×2)
сжимаются до 5: `TourNote → TourNoteInfoModel`, `TourNoteCreateModel → TourNote`,
`TourNoteInfoModel → TourNote`, `TranslatableCreateModel → TourNoteTranslation`,
`TranslatableInfoModel → TourNoteTranslation` + `TourNoteTranslation → TranslatableInfoModel`
(`Type → 0`). В `Tour → TourInfoModel`: `Notes` мапится с
`.OrderBy(n => n.Type).ThenBy(n => n.SortOrder)`.

Новых кодов ошибок не требуется.

### 3.3.5 Что ломается в контракте API и как это увидит админка

Ломается — по-настоящему. Изменение breaking:

| Было | Стало |
| --- | --- |
| `TourInfoModel.organizationalDetails: [{id, sortOrder, translations}]` | — |
| `TourInfoModel.restrictions: [{id, sortOrder, translations}]` | `TourInfoModel.notes: [{id, type, sortOrder, translations}]` |
| `TourCreateModel.organizationalDetails` / `.restrictions` | `TourCreateModel.notes` |
| `InitTour` → два пустых массива | `InitTour` → `notes: []` |

**Что при этом реально придётся править на фронте админки — три файла:**

- `Frontend/src/shared/types/attours.ts` — заменить `OrganizationalDetailInfoModel` /
  `RestrictionInfoModel` / соответствующие Create-модели на `TourNoteInfoModel` /
  `TourNoteCreateModel`, поля в `TourInfoModel` / `TourCreateModel`.
- `Frontend/src/features/admin/lib/tourMapper.ts` — 8 мест (строки ~115-119, 142-147,
  256-260, 329-334): на чтении разложить `notes` по `type` в два массива вью-модели,
  на записи слить обратно, проставив `type`.
- `Frontend/src/features/admin/lib/enums.ts` — добавить `TourNoteType`.

**Вью-модель формы и сам UI менять НЕ нужно.** `tourMapper.ts` по своей же документации —
единственное место, знающее соответствие wire ↔ view-model; поля вью-модели
`organizationalDetails` и `restrictions` остаются как есть. Значит `types/form.ts`,
`tourFormReducer.ts`, `useTourForm.ts`, `TourForm.tsx`, `LocalizedListEditor.tsx`,
`RepeaterControls.tsx` не затрагиваются.

Публичный сайт не затронут вообще — он всё ещё на моках (`shared/api/tours.ts`).

Альтернатива «сохранить контракт из двух списков поверх одной таблицы» рассмотрена и
отвергнута — см. развилку **D-3** (§7), окончательное слово за Давидом.

### 3.3.6 Мультиязычность

Не меняется: `TourNoteTranslation` — та же пара `LanguageCode` + `Value`. Слияние
сокращает число таблиц переводов, которые придётся наполнять при добавлении языка,
с 6 до 5.

---

## 4. Сводный порядок миграций

EF-миграции линейны, поэтому порядок фиксирован:

| # | Миграция | Пункт | Содержимое |
| --- | --- | --- | --- |
| 1 | `AddSiteSettings` | 3.1 | `SiteSetting`, `SiteSettingTranslation`, unique index на `Key`. Без данных |
| 2 | `AddRegionAndTourRegion` | 3.2 | `Region`, `RegionTranslation`, `TourRegion`, unique `Region.Slug` и `(TourId, RegionId)` |
| 3 | `SeedArmenianRegions` | 3.2 | Только данные: 11 регионов + 22 перевода, raw SQL |
| 4 | `MergeRestrictionAndOrganizationalDetailIntoTourNote` | 3.3 | Новые таблицы + перенос данных + drop четырёх старых |

3.3 идёт последней намеренно: это единственный пункт, ломающий контракт, и он должен
накатываться вместе с правкой админки. 3.1 и 3.2 можно выкатывать по одной.

Миграции накатываются вручную и только после явного «go» от Давида — правило проекта
не меняется, автоприменения на старте не вводим.

---

## 5. Сводка: что ломается в существующем API

| Пункт | Ломающее изменение | Кто заметит |
| --- | --- | --- |
| 3.1 | нет | никто |
| 3.2 | нет (только новые поля `regions` и новый контроллер). Плюс контрактное правило `Regions == null` = «не трогать» | никто до этапа 4.4 |
| 3.3 | **да**: `organizationalDetails` + `restrictions` → `notes` в `TourInfoModel`, `TourCreateModel`, `InitTour` | админка: `attours.ts`, `tourMapper.ts`, `enums.ts`. UI и вью-модель формы не меняются. Публичный сайт не затронут (на моках) |

---

## 6. Новые коды ошибок

`ATTours.Helper/Enums/GlobalErrorCode`, регион `EntityErrors` (сейчас занято до 2004):

```
SiteSettingKeyUnknown = 2005   // 400, неизвестный ключ настройки в Update
RegionNotFound        = 2006   // 400/404, несуществующий RegionId в туре
```
Новые цепочки `IExceptionHandlerChain` не заводятся — существующая
`ErrorModelExceptionHandlerChain` покрывает оба случая.

---

## 7. Развилки — нужно решение Давида

### D-1. SiteSettings: метаданные ключа — в коде или в БД?

- **A (рекомендую).** В БД только `Key` + `Value` + переводы. `IsPublic`, `ValueType`,
  `IsTranslatable`, группа, порядок и дефолт — в файле-каталоге в коде.
  *Плюсы:* один источник правды; `IsPublic` нельзя случайно переключить из админки;
  новая настройка = одна строка кода, без миграции и без сида.
  *Минусы:* добавление настройки требует деплоя бэка (но не миграции); админка не может
  завести произвольный ключ — неизвестный `Key` в `Update` даёт 400.
- **B.** Все метаданные — колонки в таблице `SiteSetting`, заполняются сидом.
  *Плюсы:* настройку можно завести прямо из админки, без деплоя.
  *Минусы:* два источника правды (код знает про `hero.title`, БД знает свои флаги —
  они разъедутся); нужен сид или ручной INSERT для каждой новой настройки; тумблер
  «публично» в админке становится риском утечки.

> **Вопрос:** должна ли админка уметь заводить новые ключи настроек сама, или набор
> настроек — часть кода и меняется вместе с фронтом, который их отображает?
> Моя рекомендация — **A**: фронт всё равно обязан знать ключ, чтобы нарисовать поле,
> так что «настройка без деплоя» на практике не работает.

### D-2. Обязателен ли регион у тура?

- **A (рекомендую).** Регион необязателен. Тур без региона просто не появляется на карте.
- **B.** Минимум 1 регион, правило в `TourValidationService`.

> **Вопрос:** сегодня регионов нет ни у одного тура. Если сделать регион обязательным
> сразу, `UpdateTour` начнёт отвечать 400 на **любой** существующий тур, пока админ
> вручную не проставит регионы — то есть админка временно перестанет сохранять
> уже созданные туры. Рекомендую **A** сейчас и, при желании, ужесточить до **B**
> после этапа 4.4, когда регионы будут проставлены.

### D-3. Слияние `Restriction` + `OrganizationalDetail`: ломать контракт API или нет?

- **A (рекомендую).** Слить и в БД, и в контракте: один список `notes` с полем `type`.
  *Цена:* 3 файла во фронте админки (`attours.ts`, `tourMapper.ts`, `enums.ts`), UI формы
  не меняется. *Выгода:* маппинг схлопывается с ~8 блоков до 5; этап 3.4
  (`TourNoteTemplate` — один каталог на оба вида) ложится без переходников; `type`
  на проводе там всё равно понадобится.
- **B.** Слить только в БД, в API оставить два списка `organizationalDetails` / `restrictions`.
  *Цена:* фронт не трогаем вообще. *Выгода сомнительная:* маппер обязан на чтении
  разложить `Notes` по типу, а на записи склеить два списка обратно (`AfterMap`-склейка
  уровня `BuildTourDetails`) — эта развилка остаётся в коде навсегда и удваивается
  в 3.4.

> **Вопрос:** согласен ли Давид на breaking change контракта тура, если правка админки
> ограничена тремя файлами и не затрагивает UI формы? Рекомендую **A**; **B** имеет
> смысл только если админку в этой волне трогать нельзя вообще.

### D-4. Логотип — один или пара под светлую/тёмную тему?

- **A (рекомендую).** Один ключ `branding.logoUrl`. Чек-лист говорит просто «логотип».
- **B.** Пара `branding.logoUrl` + `branding.logoDarkUrl`.

> **Вопрос:** сайт имеет светлую и тёмную темы; один логотип может плохо читаться в одной
> из них. Добавить второй ключ позже — одна строка в каталоге, **без миграции**, поэтому
> рекомендую начать с **A** и не гадать.

---

## 8. Риски и спорное

1. **Три контроллера без DI.** Замороженное решение соблюдено, но цена растёт: после 3.1–3.2
   контроллеров становится три, и каждый сервис поднимает **свой** `DbContext` через
   `ATToursContextFactory` + строку из статического синглтона `CommonSettings`. Экран
   настроек + список регионов + список туров = минимум 4 независимых подключения на
   загрузку страницы админки. Это не блокер и не переигрывается здесь — но при переводе
   на DI (отдельная задача техдолга) новые сервисы уже готовы: у всех есть конструктор,
   принимающий `IApplicationDbContext`.

2. **`SiteSettings/Update` открыт всем.** Авторизации в API нет ни на одном эндпоинте
   (факт из аудита, не гипотеза). `GetPublic` спроектирован отдельным эндпоинтом именно
   чтобы при появлении auth не резать контракт, но до тех пор любой может переписать
   hero и контакты. Это тот же риск, что уже есть у `DeleteTour`; отдельным пунктом
   этапа 3 не решается.

3. **Слаги регионов дублируются между фронтом и бэком.** Источник правды после сида —
   БД, но фронтовый `RegionSlug` остаётся отдельным литеральным типом (он нужен для
   геометрии карты). Расхождение проявится молча: регион просто перестанет находиться
   фильтром. Дешёвая страховка на этапе 5 — dev-time сверка списка из
   `RegionController/GetRegionsClient` с `REGIONS` и предупреждение в консоль.

4. **Уникальный индекс на переводы не заводится.** Ни одна `*Translation`-таблица проекта
   не имеет unique index на `(OwnerId, LanguageCode, Type)`, поэтому дубликаты переводов
   технически возможны. Новые таблицы (`RegionTranslation`, `SiteSettingTranslation`,
   `TourNoteTranslation`) намеренно следуют этому же соглашению — вводить ограничение
   для трёх новых таблиц и не вводить для шести старых было бы хуже. Кандидат в общий
   техдолг, не в этап 3.

5. **`Regions == null` трактуется иначе, чем остальные коллекции графа тура.** Это
   осознанная асимметрия контракта ради защиты от потери данных в окне между 3.2 и 4.4
   (§3.2.9). Асимметрию нужно снять после 4.4, когда админка начнёт всегда присылать
   `regions` — тогда правило можно привести к общему виду.

6. **`Down()` у миграции слияния не восстанавливает `Id`.** Откат безопасен только до
   первого сохранения тура через админку на новой схеме. Практический вывод для
   `backend-tester`: проверять слияние на копии БД, а не на рабочей.
