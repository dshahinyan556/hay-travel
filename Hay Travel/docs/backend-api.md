# Контракт бэкенда (`api/Tour`)

Слоистая архитектура: контроллер (`TourController`) → сервисы (`ATTours.Service/Services/*`) → репозитории → EF Core. Контроллер использует `new XxxService()` (не DI — текущий стиль проекта).

## Енумы (сериализуются ЧИСЛАМИ, не строками)
- `TourType`: Tour=1, Excursion=2.
- `LanguageCode`: Russian=1, English=2.
- `TourTranslationType`: Title=1, ShortDescription=2, Description=3, Duration=4.
- `TourDayTranslationType`: Title=1, ShortDescription=2, Description=3, Duration=4.
- `ExpenseTranslationType.Description = 0` (на бэке опечатка `Desciption`).
- Точки маршрута / орг.детали / ограничения — отдельные упорядоченные сущности (`SortOrder`), текст как translation с `type=0`.

## Эндпоинты
| Метод | Route | Тело / параметры | Возврат |
| --- | --- | --- | --- |
| GET | `InitTour?type=` | — | `TourCreateModel` (пустой скелет) |
| POST | `CreateTour` | `TourCreateModel` | `TourCreatedModel {Id}` |
| GET | `GetAll` | — | `TourInfoModel[]` (только `!IsArchived`) |
| GET | `GetArchived` | — | `TourInfoModel[]` (только `IsArchived`) |
| GET | `InitUpdate?id=` | — | `TourInfoModel` (полный граф) |
| PUT | `UpdateTour` | `TourInfoModel` | `TourInfoModel` (перечитанный) |
| PATCH | `SetActive` | `{Id, IsActive}` | — |
| PATCH | `SetArchived` | `{Id, IsArchived}` | — |
| PATCH | `SetFeatured` | `{Id, IsFeatured}` | — (400 `TooManyFeaturedTours`/2011, если уже 6) |
| PATCH | `ReorderFeatured` | `{OrderedIds: int[]}` | — (весь набор избранных, иначе 400) |
| DELETE | `DeleteTour?id=` | — | — (каскадное удаление графа) |
| GET | `GetToursClient?languageCode=` | — | `TourInfoModel[]` (одна локаль) |
| GET | `GetFeaturedToursClient?languageCode=` | — | `TourCardModel[]` (`IsFeatured && IsActive && !IsArchived`, `OrderBy(FeaturedSortOrder)`) |
| GET | `GetTourInfo?id=&languageCode=` | — | `TourInfoModel` (одна локаль) |

## Ключевые правила
- **Модели**: `*CreateModel` — без Id (id-less); `*InfoModel` — с Id. `TourInfoModel` отдаёт `IsActive`, `IsArchived`, `IsFeatured`, `FeaturedSortOrder`, `TotalPrice`.
- **UpdateTour** реконсилит весь граф **по Id**: `Id==0` → добавить, совпадающий Id → обновить, отсутствующий в payload Id → удалить. Чужой Id → 400. `IsActive`/`IsArchived`/`IsFeatured`/`FeaturedSortOrder`/`TotalPrice` в UpdateTour игнорируются (управляются отдельно / считаются на бэке).
- **Избранное (2026-08-02)**: `Tour.IsFeatured`(bool)/`FeaturedSortOrder`(int) — ровно 2 поля. Лимит 6 одновременно избранных проверяется в `TourFeaturedService.SetFeaturedAsync` перед добавлением (не в отдельном `ValidationService` — точечный тоггл, как `IsActive`/`IsArchived`). Новый избранный тур встаёт в конец текущего порядка (`max(FeaturedSortOrder)+1`); порядок дальше меняется только через `ReorderFeatured`, которое требует ПОЛНЫЙ набор Id уже избранных туров (частичная перестановка — 400 `InvalidEntityIds`).
- **Дни** подключены к туру через join-таблицу `TourDetail` (без своего Id) — Delete/Update удаляют/реконсилят `TourDay` явно.
- **TotalPrice** — compute-on-write: Σ(TourDay.Price) при create/update.
- **Валидация** (`TourValidationService`, на create и update): экскурсия = ровно 1 день, тур ≥ 2; цена дня ≥ 0; ≥1 точка маршрута в каждом дне. Смена типа запрещена (`TourUpdateService`).

## Сервисы (карта)
`TourInitializationService` (init) · `TourCreationService` (create) · `TourInfo` (read/GetAll/InitUpdate) · `TourUpdateService` (update-reconcile) · `TourActivationService` (SetActive) · `TourArchivalService` (SetArchived) · `TourFeaturedService` (SetFeatured/ReorderFeatured) · `TourDeletionService` (hard delete) · `TourValidationService` (валидация).

## Регионы (`api/Region`) — тизер редактируется, остальное фиксировано
Имя/слаг/`SortOrder` заведены миграцией `SeedArmenianRegions`, `Create`/`Update`/`Delete` для них нет и не планируется. Единственное исключение (2026-08-02) — тизер (`RegionTranslationType.Blurb = 2`, был в энуме заранее, но не был подключён): `PUT UpdateBlurb {Id, BlurbRu, BlurbEn}` через `RegionBlurbUpdateService`, точечно апсертит две строки перевода (Type=Blurb), не трогая имя (Type=Name) и остальные поля. Сид текущего текста — миграция `SeedRegionBlurbs` (тот же текст, что раньше был захардкожен в `Frontend/src/shared/data/armeniaRegions.ts`).

## Настройки сайта (`api/SiteSettings`) — группа `Content` (2026-08-02)
`SiteSettingGroup.Content = 6` — тексты публичного сайта вне Hero, раньше хардкод во фронте: `content.footerTagline`, `content.catalogTitle`, `content.catalogSubtitle`, `content.featuredHeading`. Как и остальные группы, состав ключей — только в `SiteSettingCatalog.cs` (ADR 002), без миграции. **Отличие от старых ключей**: у этих (и заодно у `contacts.phone`/`contacts.email`/`contacts.address`, которые раньше никуда не были подключены на публичном сайте) впервые заполнены `defaultValue`/`defaultTranslations` в определении — раньше у всех ключей дефолт был пустой строкой, и единственным фолбэком был захардкоженный текст на фронте (`hero.fallback.*` в `dictionary.ts`). Теперь дефолт — часть бэкенд-каталога: `SiteSettingsInfo.ResolveValue`/`CreateFromDefinition` уже умели это (правило `перевод ?? Value ?? DefaultValue`), просто раньше никто не передавал непустой `defaultValue`. Практический эффект: admin видит реальный текст сразу, публичный сайт никогда не показывает пустоту до первого сохранения в админке, и фронт для этих ключей больше не хранит собственную копию текста-по-умолчанию.

## Миграции
Актуальные (в `ATTours.DataLayer/Migrations`): `InitialCreate`, `AddRoutePoint`, `AddOrganizationalDetailAndRestriction`, `ChangeTourDayChildrenToCascade`, `AddTourIsArchived`, `AddSiteSettings`, `AddRegionAndTourRegion`, `SeedArmenianRegions`, `MergeRestrictionAndOrganizationalDetailIntoTourNote`, `AddReferenceCatalogs`, `AddTourFeatured`, `SeedRegionBlurbs`.
