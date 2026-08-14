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
| GET | `api/ExchangeRate/GetCurrent` | — (анонимный) | `ExchangeRatesModel {baseCurrency, lastUpdatedUtc, rateDateUtc, isStale, rates[]}` |

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

## Курсы валют (`api/ExchangeRate`) — 2026-08-06
Публичный сайт научился показывать цены в AMD/USD/EUR/RUB по выбору посетителя (см.
`client-site.md`). Бэкенд отдаёт только курсы — конвертация, тирная наценка по кол-ву
гостей и округление под валюту считаются **на фронте** (см. ADR 008); сервер не
пересчитывает и не хранит «финальную» цену, т.к. брони/оплаты пока нет и доверенная цена
никому не нужна.

- **`ExchangeRate`** — таблица, по одной строке на USD/EUR/RUB (`Code`, `RatePerUnitAmd`
  `decimal(18,6)`, `RateDateUtc`, `LastUpdatedUtc`, `LastAttemptUtc`). **AMD не хранится** —
  это база (курс всегда 1), приходит в ответе из кодового каталога `CurrencyCatalog`
  (там же — символ и `RoundingStep` на валюту: AMD/RUB→100, USD/EUR→1; фронт этот шаг
  не хардкодит, читает из ответа).
- **Обновление курсов — из ЦБ Армении (CBA)**, `ATTours.Service/ExchangeRates/
  CbaExchangeRateClient.cs`: сырой `HttpClient` + вручную собранный SOAP 1.1-конверт на
  `https://api.cba.am/exchangerates.asmx` (операция `ExchangeRatesLatest`), без WCF —
  один метод с зафиксированным контрактом не оправдывает codegen-тулчейн. **Важная деталь
  протокола**: CBA отдаёт `Rate` за `Amount` единиц валюты (не всегда 1 — есть валюты
  с котировкой за 100/1000), реальный курс за 1 ед. = `Rate / Amount`.
- **Протухание — 3 часа.** `ExchangeRateInfo` (по образцу `SiteSettingsInfo`/
  `SiteSettingsUpdateService` — общий контекст без `using`, обновление-потом-перечитать):
  если `LastUpdatedUtc` старше 3ч — синхронный ре-фетч у CBA и апсерт, иначе отдача из БД
  как есть. **При сбое CBA — отдаётся последний известный курс с `isStale:true`**, не
  ошибка: деньги нигде не двигаются, курс дрейфует <1%/сутки, а падение всего каталога
  цен из-за стороннего сбоя — хуже, чем слегка устаревший курс. Троттлинг повторных
  попыток к CBA — 10 минут (`LastAttemptUtc`), чтобы простой CBA не бомбардировался на
  каждый заход посетителя. Жёсткая ошибка (503, `GlobalErrorCode.ExchangeRatesUnavailable
  = 2012`) — только если строк в таблице вообще никогда не было и CBA тоже недоступен.
- **`IMemoryCache` сознательно не добавлен** — таблица с 3-часовой проверкой уже и есть
  кэш, при текущем масштабе (один инстанс) доп. слой почти ничего не даёт.
- **Новый ключ настроек**: `content.largeGroupInvitation` (группа `Content`, `sortOrder:
  23`, RU+EN, `SiteSettingCatalog.cs`) — текст для групп от 7 человек («рассчитаем
  стоимость индивидуально»), показывается на публичном сайте вместо цены, редактируется
  в админке без деплоя.

## Заказы (`api/Order`) и доступность (`api/Availability`) — 2026-08-13
Первая реальная система бронирования: до этого `BookingCard` на публичном сайте был UI-заглушкой без бэкенда (см. `client-site.md`). Спецификации — `docs/specs/001-booking-calendar-backend.md` (+ `docs/adr/012`, `014`), `docs/specs/003-calendar-frontend.md` (+ `docs/adr/015`, `016`).

**Сущности**: `Order` (User, Tour, дата, кол-во гостей, статус) + `OrderPayment` — 1:1, своя таблица, не owned-type (ADR 014): деньги вынесены отдельно как точка расширения под будущий платёжный шлюз, чтобы не переделывать `Order` при его подключении. `ClosureRule` — правило закрытия дня/дней: `Type` (`SpecificDate` | `Weekly`), `Action` (`Close` | `Open` — `Open` нужен, чтобы точечно переоткрыть день поверх недельного правила), `TourId` nullable (`null` = глобально, для всех туров). Правила закрытия хранятся как правила и резолвятся на чтении (`ClosureRuleResolver`, чистая функция в `ATTours.Service`), а не материализуются в отдельные строки-даты (ADR 012) — приоритет: тур+дата > глобально+дата > тур+неделя > глобально+неделя.

**`OrderStatus`**: `PendingConfirmation=1` (начальный статус ЛЮБОГО нового заказа, с B12 — 2026-08-13), `Confirmed=2` (только через `PATCH Order/Confirm`, Admin-only), `Cancelled=3` (не попадает в занятость календаря). Начальный статус по-прежнему выбирается в одном месте (`OrderCreationService`).

**`Order.ConfirmedAtUtc`** (nullable `DateTime`, миграция `AddOrderConfirmedAtUtc`, 2026-08-13) — момент подтверждения, ставит `OrderConfirmationService` тем же присваиванием, что и `Status = Confirmed`. `null`, пока заказ `PendingConfirmation`; старые заказы, подтверждённые до этой миграции, остаются с `null` навсегда — задним числом не проставлялось (нет достоверного момента, только неизвестно какой `Status`-апдейт это был).

### Правка/подтверждение заказа (B12, 2026-08-13)
Раньше апдейта заказа не было вообще — только отмена. "Редактирование" на фронте физически било в `Order/Create` и плодило дубликаты броней. Закрыто:
- **`PUT api/Order/Update`** (`OrderUpdateModel { id, tourDate, guestCount }`) — только пока `Status == PendingConfirmation` (иначе `OrderNotEditable=2021`); тот же владелец/админ-доступ, что у `Cancel`. `OrderUpdateService` пересчитывает `OrderPayment.TotalAmount` от уже зафиксированного `TourPriceSnapshot` (снапшот не переоценивается) и повторно гоняет `OrderValidationService` (гостей, дату, доступность).
- **`PATCH api/Order/Confirm`** (Admin-only) — `PendingConfirmation → Confirmed`, `OrderConfirmationService`, тот же паттерн, что `OrderCancellationService`.
- **Email-уведомление** админу при каждом новом заказе (`IEmailSender.SendNewOrderNotificationAsync`, все 3 реализации) — на `EmailSettings.AdminNotificationEmail` (по умолчанию = `FromEmail`, отдельно не задан).

**Бронирование — только для залогиненных** (`Order.UserId` — обязательный FK из токена, не из тела запроса). Оплата на этом этапе — без платёжного шлюза: `OrderPayment` фиксирует сумму/предоплату как число, оплата идёт вне сайта (звонок/перевод).

**Групповой тариф теперь и на бэкенде (B12, 2026-08-13, было расхождение)**: раньше `OrderCreationService` считал `TotalAmount = TourPriceSnapshot × GuestCount` безусловно — для 1–4 гостей это давало сумму В РАЗЫ больше, чем «Итого» на сайте (цена там фиксирована за бронь целиком, не за гостя). Обнаружилось, когда `order.payment` наконец стали показывать в админке (`OrderDetailPage`, см. `admin-panel.md`) — до этого поле нигде не рендерилось именно по этой причине. Исправлено: `OrderCreationService.ResolveTotalAmount` дублирует правило `shared/currency/pricing.ts` (`resolveTier`/`applyGroupTier`) в C# — 1–4 гостя: `TotalAmount = TourPriceSnapshot` (флэт, без умножения); 5–6: `× 1.2`; 7+: `0` («цена по запросу», как и на сайте — `largeGroupInvitation`, сумма не автоматическая). TS и C# не делят код в этом репозитории, так что тариф меняется в обоих местах вручную. **Старые заказы, созданные до фикса, оставлены как есть** — Давид решил не делать бэкфилл (тестовые данные, реальных платежей ещё нет).

| Метод | Route | Возврат |
| --- | --- | --- |
| POST | `api/Order/Create` | `OrderInfoModel` |
| PUT | `api/Order/Update` | `OrderInfoModel` (только `PendingConfirmation`) |
| PATCH | `api/Order/Confirm` | — (Admin-only, только `PendingConfirmation`) |
| GET | `api/Order/GetMine` | `OrderInfoModel[]` (заказы текущего пользователя) |
| GET | `api/Order/GetAll` | `OrderInfoModel[]` (Admin-only, фильтры `tourId`/`from`/`to`/`status` — все опциональны) |
| GET | `api/Order/{id}` | `OrderInfoModel` (Admin-only, B12 2026-08-13 — деталь одного заказа для `OrderDetailPage`; 404 `OrderNotFound` если нет) |
| PATCH | `api/Order/Cancel` | — |
| GET | `api/Availability/GetCalendar` | `CalendarMonthModel` (по дню: кол-во заказов по турам + статус закрытия, Admin-only) |
| GET | `api/Availability/GetRules` | `ClosureRuleInfoModel[]` (включая `BatchId`, см. ниже) |
| POST | `api/Availability/CreateRules` | — (массовое создание, кап `MAX_BULK_RULES` на фронте; все правила одного вызова получают общий `BatchId`) |
| DELETE | `api/Availability/DeleteRule` | — (одно правило по id) |
| DELETE | `api/Availability/DeleteRules` | — (`List<int>` в теле — группа целиком или произвольная выборка; отсутствующие id молча пропускаются, 2026-08-14) |
| GET | `api/Availability/GetClosedDates` | список закрытых дат (публичный, для `DatePicker` на детальной странице тура) |

**Гард на удаление тура**: `TourDeletionService` теперь проверяет `TourHasOrders` — тур с существующими заказами удалить нельзя (внятный код ошибки вместо сырой FK-ошибки).

**Коды ошибок** (`GlobalErrorCode`): `SiteSettingValueNotAllowed=2013`, `TourDateUnavailable=2014`, `InvalidGuestCount=2015`, `OrderDateInPast=2016`, `InvalidClosureRule=2017`, `TourHasOrders=2018`, `OrderAccessForbidden=2019`, `OrderNotFound=2020` (сдвинут с зарезервированного в спеке 2013 — коллизия с параллельно реализованным `SiteSettingValueNotAllowed`, разрешена смещением неиспользуемого на фронте кода), `OrderNotEditable=2021` (B12 — `Update`/`Confirm` на не-`PendingConfirmation` заказе), `ClosureDateInPast=2022` (B12 — см. ниже).

### Бэкдейтинг запрещён везде (B12, 2026-08-13)
Раньше массовое закрытие дней сознательно разрешало прошедшие даты ("хозяйственный смысл"), а точечный клик по прошедшему дню в админке вообще не проверялся. Решение Давида: запретить полностью и без исключений — единственная и общая для single-day/bulk точка входа (`ClosureRuleCreateModel` → `ClosureRuleCreationService` → `ClosureRuleValidationService`) теперь отбивает `SpecificDate.Date < today` и `Weekly.EffectiveFrom < today` кодом `ClosureDateInPast=2022`. На фронте — `BulkClosurePanel`'s `DatePicker`ы теперь `disablePast` + та же проверка в `compileBulkForm`, и `DayClosureControls` полностью блокируется (не просто прячется) для прошедших дней.

### Причина закрытия дня в календаре (B12, 2026-08-13)
`ClosureRuleResolver.IsClosed` раньше отдавал только `bool`, выбрасывая победившее правило (и его `Reason`). Добавлен `ClosureRuleResolver.Resolve(...)`, возвращающий само правило; `CalendarDayModel` получил поле `ClosureReason` (только для глобального закрытия — tour-scope причина по-прежнему видна лишь во вкладке «Блокировки»). Плюс: одиночное закрытие дня (`DayClosureControls`) теперь тоже собирает `Reason` — раньше поле было только у массовой операции.

### Группировка правил закрытия — `BatchId` (2026-08-14)
`ClosureRule.BatchId` (`Guid?`, миграция `AddClosureRuleBatchId`) — все правила, созданные ОДНИМ вызовом `CreateRules` (будь то массовая операция или одиночный toggle из `DayClosureControls`, оба идут через один и тот же эндпоинт), получают общий `BatchId`, который проставляет контроллер (`Guid.NewGuid()` на весь список), а не клиент. `null` — только у правил, созданных до этой миграции. Ничего не резолвится/фильтруется по `BatchId` на бэкенде — он существует исключительно для того, чтобы фронт (`ClosureRulesTable`, вкладка «Блокировки») мог группировать строки одной операции визуально и удалять их вместе через новый `DeleteRules`. Переименование в UI: «Правило» → «Блокировка» (только копия экрана, сущность в коде осталась `ClosureRule`).

**Админка**: раздел «Заказы» (`/admin/orders` — список + `/admin/orders/:id` деталь) + «Календарь» (`/admin/calendar`) — см. `admin-panel.md`.

## Настройки темы/палитры (`api/SiteSettings` — группа `Theme`) — 2026-08-13
Спецификация — `docs/specs/002-design-settings-backend.md` (+ `docs/adr/013`). Новая группа `SiteSettingGroup.Theme = 7` (не `Branding` — там только логотип):
- **`theme.activePalette`** — id активного пресета палитры сайта, тип контрола `Select` (новый `SettingValueType.Select=5`), допустимые значения — код-каталог `ThemePaletteCatalog` (не миграция): `obsidian` (дефолт, «Обсидиан + золото») и `basalt` («Базальт и медь», см. `client-site.md` — НЕ дефолт). Сервер валидирует значение против `definition.Options` (код 2013 при недопустимом).
- **`theme.defaultMode`** — `dark`/`light`, мягкий дефолт для новых посетителей; существующий клиентский переключатель темы не убирается.
- **`branding.authImageUrl`** (группа `Branding`, `sortOrder: 26`) — URL фото для сплит-экрана `/auth`, тот же паттерн, что `hero.imageUrl`/`branding.logoUrl`.
- **`theme.navStyle`** (`sortOrder: 27`, 2026-08-13) — стиль шапки+нижней мобильной навигации публичного сайта: `pill` (дефолт, текущее плавающее меню) / `rail` («Стеклянная лента» — полноширинная панель со скролл-блюром). Тот же класс решения, что `theme.activePalette` — админ выбирает готовый визуальный вариант, реализация обоих живёт во фронте. Ключ намеренно остался в `Theme`, а не в новой группе: решение backend-architect — это переиспользование механизма ADR 013, не новая сущность, отдельного ADR не заводилось (см. комментарий над записью в `SiteSettingCatalog.cs`).

Новых сущностей/репозиториев/миграции не потребовалось — всё укладывается в уже существующий каталог-в-коде `SiteSettingCatalog` (ADR 002).

## Миграции
Актуальные (в `ATTours.DataLayer/Migrations`): `InitialCreate`, `AddRoutePoint`, `AddOrganizationalDetailAndRestriction`, `ChangeTourDayChildrenToCascade`, `AddTourIsArchived`, `AddSiteSettings`, `AddRegionAndTourRegion`, `SeedArmenianRegions`, `MergeRestrictionAndOrganizationalDetailIntoTourNote`, `AddReferenceCatalogs`, `AddTourFeatured`, `SeedRegionBlurbs`, `AddExchangeRate`, `AddOrdersAndClosureRules`, `AddTourRequiresPrepayment` (2026-08-13 — `Tour.RequiresPrepayment`, `bit NOT NULL DEFAULT 1`; см. `product-model.md`), `AddClosureRuleBatchId` (2026-08-14 — `ClosureRule.BatchId`, `uniqueidentifier NULL`; см. выше). Миграции применяются автоматически при старте backend (с retry, с 2026-08-10) — отдельного ручного шага `dotnet ef database update` в проде не требуется.
