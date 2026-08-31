# Контракт бэкенда (`api/Tour`)

Слоистая архитектура: контроллер (`TourController`) → сервисы (`ATTours.Service/Services/*`) → репозитории → EF Core. Контроллер использует `new XxxService()` (не DI — текущий стиль проекта).

## Енумы (сериализуются ЧИСЛАМИ, не строками)
- `TourType`: Tour=1, Excursion=2, **Transfer=3** (2026-08-29).
- `TourFormat` (2026-08-29): Individual=1, Group=2, Both=3. Nullable — `null` у трансфера.
- `TransferRoutePointKind` (2026-08-29): From=1, Stop=2, To=3.
- `OrderLineKind` (2026-08-29): Product=1, CustomTransfer=2.
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
| PATCH | `SetFeatured` | `{Id, IsFeatured}` | — (400 `TooManyFeaturedTours`/2011, если уже 9 — лимит расширен 6 → 9 2026-08-29) |
| PATCH | `ReorderFeatured` | `{OrderedIds: int[]}` | — (весь набор избранных, иначе 400) |
| DELETE | `DeleteTour?id=` | — | — (каскадное удаление графа) |
| GET | `GetToursClient?languageCode=` | — | `TourInfoModel[]` (одна локаль; **трансферы исключены** фильтром `Type != Transfer`, 2026-08-29) |
| GET | `GetFeaturedToursClient?languageCode=` | — | `TourCardModel[]` (`IsFeatured && IsActive && !IsArchived`, `OrderBy(FeaturedSortOrder)`) |
| GET | `GetTourInfo?id=&languageCode=` | — | `TourInfoModel` (одна локаль; на трансфер — 404, у него своя read-модель `api/Transfer/GetTransferInfo`) |
| GET | `api/ExchangeRate/GetCurrent` | — (анонимный) | `ExchangeRatesModel {baseCurrency, lastUpdatedUtc, rateDateUtc, isStale, rates[]}` |

## Ключевые правила
- **Модели**: `*CreateModel` — без Id (id-less); `*InfoModel` — с Id. `TourInfoModel` отдаёт `IsActive`, `IsArchived`, `IsFeatured`, `FeaturedSortOrder`, `TotalPrice`.
- **UpdateTour** реконсилит весь граф **по Id**: `Id==0` → добавить, совпадающий Id → обновить, отсутствующий в payload Id → удалить. Чужой Id → 400. `IsActive`/`IsArchived`/`IsFeatured`/`FeaturedSortOrder`/`TotalPrice` в UpdateTour игнорируются (управляются отдельно / считаются на бэке).
- **Избранное (2026-08-02)**: `Tour.IsFeatured`(bool)/`FeaturedSortOrder`(int) — ровно 2 поля. Лимит одновременно избранных (6 → **9** с 2026-08-29) проверяется в `TourFeaturedService.SetFeaturedAsync` перед добавлением (не в отдельном `ValidationService` — точечный тоггл, как `IsActive`/`IsArchived`). Новый избранный тур встаёт в конец текущего порядка (`max(FeaturedSortOrder)+1`); порядок дальше меняется только через `ReorderFeatured`, которое требует ПОЛНЫЙ набор Id уже избранных туров (частичная перестановка — 400 `InvalidEntityIds`).
- **Дни** подключены к туру через join-таблицу `TourDetail` (без своего Id) — Delete/Update удаляют/реконсилят `TourDay` явно.
- **TotalPrice** — compute-on-write: Σ(TourDay.Price) при create/update.
- **Валидация** (`TourValidationService`, на create и update): экскурсия = ровно 1 день, тур ≥ 2; цена дня ≥ 0; ≥1 точка маршрута в каждом дне. Смена типа запрещена (`TourUpdateService`).

## AsSplitQuery на графе чтения тура (2026-08-16)

`GetTourInfo` (публичная детальная тура) уходил за 10+ секунд на туре с большой галереей —
причина не в размере фото, а в форме запроса. `IncludeTourGraphForClient` тянет ~8
sibling-коллекций с одного корня одним `Include`-чейном (`TourDetails→TourDay→
{Translations, GalleryImages, RoutePoints→...}` плюс `Translations`/`AdditionalExpenses`/
`Notes`/`TourRegions`/`TourTags` на `Tour`) — EF Core по умолчанию собирает это в ОДИН JOIN,
где строки перемножаются по каждой комбинации коллекций (cartesian explosion): с парой фото
незаметно, с десятками — катастрофично. Исправлено `.AsSplitQuery()` в
`TourClientInfo.GetClientDetailAsync` (EF Core бьёт граф на отдельные SQL-запросы по коллекции
вместо одного JOIN) — 10-12 сек → ~0.2-0.4 сек.

`AsSplitQuery()` добавлен как метод самой репозиторной абстракции
(`IEntityQueryableRepository<T>.AsSplitQuery()`, `EntityQueryableRepository.cs`) — доступен
любому месту, строящему `Include`-граф с несколькими sibling-коллекциями, не только этому.

**Дополнено тем же днём** (Давид подтвердил: вход в админку, открытие тура на редактирование и
сохранение тоже тормозили — та же причина на других вызывающих местах):
- `TourInfo.GetEntityQueryableRepository()` (админский `InitUpdate` — открытие одного тура) и
  `TourUpdateService` (загрузка tracked-копии перед сохранением) получили `.AsSplitQuery()`
  так же, как клиентский путь выше.
- `TourInfo.GetAllAsync()` (админский СПИСОК — дашборд, страница продуктов) пошёл дальше
  `AsSplitQuery` и получил отдельный облегчённый граф — `IncludeTourAdminListGraph`
  (`TourGraphQueryExtensions.cs`), по аналогии с клиентским `IncludeTourCardGraph` (D-11).
  Список ничего не показывает из содержимого дня (только `tourDays.length`), поэтому граф
  включает `TourDetails.TourDay` голой ссылкой (без неё маппер отдал бы `null` на каждом дне),
  но БЕЗ `TourDay.Translations`/`GalleryImages`/`RoutePoints` — именно эта вложенность и была
  источником cartesian explosion, здесь ещё и помноженной на количество туров в каталоге.
  `TourInfo.InitUpdate` (открытие ОДНОГО тура) остался на полном графе — форма редактирует всё.

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

> Заметка о доке: описание выше (`OrderStatus` из 3 значений, `Order.ConfirmedAtUtc`, `PUT
> Order/Update` без строк) — модель ДО мульти-строчного редизайна заказов (ADR 019, 2026-08-16).
> Актуальный контракт: `OrderStatus` из 7 значений (см. `Backend/ATTours.Common/Enums/
> OrderStatus.cs`), `Order` — заголовок над `Order.Lines[]`, деньги/предоплата/исполнитель/
> pickup-детали — на каждой строке. Полная переработка этого раздела не входила в объём задачи
> ниже — только точечное добавление того, что реально изменилось.

### Журнал событий заказа + notify-флаг у назначения (2026-08-21)
Чек-лист — `checklists/order-toolbar-summary-checklist-2026-08-21.txt`. Контракт спроектирован
`backend-architect` целиком до реализации — `docs/specs/007-order-event-log-backend.md` +
`docs/adr/020-order-event-log-outside-mutation-transaction.md` — детали ниже только сверху.

- **`OrderEvent`** (`ATTours.Common`) — read-only audit-log, FK на `Order` (Cascade). Поля:
  `OrderId`, `Type` (`OrderEventType`: `Created=1, StatusChanged=2, Updated=3, LineAdded=4,
  LineRemoved=5, LineUpdated=6, EmployeeAssigned=7, SentToClient=8, PaymentAdded=9`),
  `Description` (готовый русский текст, до 1000 символов — обрезается с многоточием, если длиннее;
  в спеке лимита не было, добавлено при реализации, т.к. `RejectReason` до 2000 символов иначе мог
  бы уронить вставку события), `ActorUserId` (`int?`, БЕЗ FK — заказ может пережить удаление
  пользователя), `ActorFullName` (снапшот имени НА МОМЕНТ события, не резолвится заново), `CreatedAtUtc`.
  Индекс `(OrderId, CreatedAtUtc)`. Миграция `AddOrderEvent`.
- **Пишется вне транзакции самой мутации**, статическим `OrderEventLog` — ПОСЛЕ успешного
  выполнения (`OrderController`, 9 точек вызова). Сбой записи лога проглатывается (try/catch), тот
  же принцип, что у `IEmailSender.SendAsync` — история не должна ронять саму операцию.
  Логируются ВСЕ мутирующие эндпоинты `OrderController`, КРОМЕ `Delete` (каскад всё равно снесёт
  журнал вместе с заказом). `Create` тоже логируется (`Created`).
- **Чтение — отдельный эндпоинт**, не поле `OrderInfoModel` (чтобы неограниченно растущий список
  не утекал в граф «Мои заказы»/админский список/PDF/письма):
  `GET api/Order/{id}/Events` → `OrderEventInfoModel[]` (Admin-only, сортировка `CreatedAtUtc desc`,
  без пагинации, несуществующий заказ → `[]` + 200, не 404).
- **`AssignEmployee` научился НЕ слать письмо.** `OrderAssignEmployeeModel.SendEmail` (`bool`,
  default `true` — старые вызовы ведут себя как раньше). `false` — назначает молча, без генерации
  PDF и `SendAssignmentAsync`; `EmployeeAssigned`-событие пишется в обоих случаях. Нужно для
  попапа «Назначить исполнителя» в админке (кнопки «Назначить» vs «Назначить и отправить письмо»
  — см. `admin-panel.md`).
- Три сервиса получили внутренние Result-типы, чтобы отдать «было/стало» наружу для текста события
  (по образцу уже существующего `OrderAssignEmployeeResult`): `OrderStatusService.SetStatusAsync` →
  `OrderStatusChangeResult`, `OrderUpdateService.UpdateAsync` → `OrderUpdateResult`,
  `OrderLineService.RemoveLineAsync` → `OrderLineRemovedResult`. HTTP-контракты этих трёх
  эндпоинтов не изменились — это внутренние сигнатуры сервисов, не тела запроса/ответа.

## Роль исполнителя (Задача D, 2026-08-21/22) — база, ЧАСТИЧНО заменена редизайном 2026-08-23
`EmployeeJobRole` (`Driver=1, Guide=2, DriverGuide=3`, отдельный enum от `RoleType`) и
`User.DefaultJobRole` (`PATCH api/Users/SetJobRole`) — в силе без изменений. Всё, что касалось
ОДНОГО исполнителя на строке (`OrderLine.EmployeeRole`, `UnassignEmployee {OrderId, LineId}`) —
заменено мульти-исполнительской моделью, см. следующий раздел. Полная история решения (зачем
`EmployeeJobRole` — отдельный enum, почему `DefaultJobRole` необязателен) — по-прежнему в
`docs/architecture-role-notifications.md` ЧАСТЬ D.

## Мульти-исполнители на строке заказа + настраиваемые получатели + билингвальные письма — 2026-08-23
Полное архитектурное решение — `docs/architecture-notification-recipients-multi-employee.md`
(бэкенд) и `docs/architecture-notification-frontend.md` (фронт). Заменяет одиночного исполнителя
на строке (Задача D) и зашитых в код получателей писем + RU-only шаблоны (Задача E, было в этом
файле ниже). Причина редизайна — на одной строке заказа нужно несколько исполнителей одновременно
(например водитель + гид), у каждого своя роль и свои детали для выполнения; получатели писем
должны настраиваться админом, а не жить в коде; клиенты и сотрудники бывают англоязычными.

- **`OrderLineEmployee`** (новая сущность, заменяет `OrderLine.EmployeeId/EmployeeRole/
  PickupDetails/NavigatorLink`) — join `OrderLine`×`User`, unique `(OrderLineId, EmployeeId)`
  (один и тот же человек не добавляется на строку дважды — случай «и водитель, и гид»
  покрывается значением `EmployeeJobRole.DriverGuide`, не второй строкой). На каждой связке —
  своя роль (non-nullable, гейт `EmployeeRoleRequired=2029` не изменился) и свои
  `PickupDetails`/`NavigatorLink`/`Comment`/`CommentEn`. Пустое поле нигде не появляется — ни в
  PDF (было так и раньше), ни в письме (раньше в письме подставлялись заглушки «не указано»/«не
  указан» — это было расхождение с PDF, исправлено).
- **`AssignEmployee` — аддитивный upsert**, не replace: `OrderAssignEmployeeModel` принимает
  список `{EmployeeId, EmployeeRole}[]`, каждый добавляется/обновляется точечно, остальные
  исполнители строки не трогаются (bulk-клик больше не стирает случайно назначенных ранее людей).
  **`UnassignEmployee`** — `{OrderId, LineId: int?, EmployeeId: int?}`: `EmployeeId` задан — снять
  конкретного человека, не задан — снять всех со строки/заказа (та же bulk-семантика `LineId`,
  что раньше). Идемпотентно, письмо/событие только если реально кто-то был снят.
- **`GetAssignedToMe`** (кабинет сотрудника) фильтрует по `OrderLineEmployee.EmployeeId`, не по
  `OrderLine.EmployeeId` — индекс переехал вместе с полем.
- **`User.PreferredLanguage`** (`LanguageCode`: `Russian=1` (дефолт) `/ English=2`) — определяет,
  какая языковая версия письма уходит этому получателю. Меняется через
  `PATCH api/Users/SetPreferredLanguage`. Получатель без `User` (см. `CustomEmail` ниже) языка не
  имеет — уходит RU-версия (осознанный дефолт, не запрошена доп. настройка под это).
- **`EmailTemplate` стал билингвальным**: `Subject/BodyHtml` (RU) + новые `SubjectEn/BodyHtmlEn` —
  для всех 4 писем, не только для письма-назначения. `IsEnabled` с сущности **убран** (рубильник
  переехал на `NotificationChannel`, см. ниже — теперь это пара событие×платформа, а не только
  событие). Санитизация/allow-list/абсолютизация media-URL из Задачи E не изменились (тот же
  `RichHtmlSanitizer`, см. ADR 026/спека 013) — применяются к обеим языковым версиям тела.
- **Получатели больше не зашиты в код.** `NotificationChannel` (`EventKey × Platform`,
  `IsEnabled`) — рубильник; `NotificationRecipient` (`EventKey`, `Platform`, `IsActive`, `Type` —
  `To/Cc/Bcc`, применим только к `Platform.Email`, `SourceType`: `User` (FK) / `OrderLinkedRole`
  (`Client`/`Employee`, закрытый список — «Исполнитель» при нескольких активных исполнителях
  уходит каждому персонально) / `CustomEmail` (строка) / `AdminMailbox` (адрес из
  `EmailSettings.AdminNotificationEmail`, единственный некастомизируемый источник — вынужденно,
  т.к. этот адрес в конфиге, а не в БД, и различается prod/dev). `NotificationPlatform`:
  `Email=1` (рабочая), `Telegram=2` (**только модель и настройки, реальной отправки нет** —
  отдельная будущая задача). PUT сохраняет событие целиком (declarative sync) — список
  получателей передаётся полностью, а не диффом.
- **`EmailTemplateController` удалён**, заменён `NotificationSettingsController` (Admin-only,
  гейтится ключом `notifications`, как раньше): `GET api/NotificationSettings` (все 4 события),
  `GET api/NotificationSettings/{eventKey}`, `PUT api/NotificationSettings` (событие целиком:
  рубильники платформ + билингвальный шаблон + полный список получателей).
- **Письма группируются по языку получателя**: одна отправка на языковую группу (сохраняя
  To/Cc/Bcc внутри неё), кроме order-linked «Исполнителя» — он всегда получает персональное письмо
  ‚ ‑ свои fulfillment-детали и своё PDF-вложение, `Type` для него не действует.
- **Миграции**: `OrderLineMultiEmployee` (2026-08-23 — новая таблица, перенос данных из старых
  полей `OrderLine` без потерь, «осиротевшие» Pickup/Navigator без исполнителя уезжают текстом в
  `OrderEvent`, затем drop старых колонок) и `NotificationRecipientsAndBilingualTemplates`
  (2026-08-23 — `User.PreferredLanguage`, EN-колонки `EmailTemplate`, таблицы
  `NotificationChannel`/`NotificationRecipient`, сид 8 каналов из старого `IsEnabled` + сид 4
  получателей из прежней зашитой в код логики, чтобы поведение не изменилось молча, drop
  `EmailTemplate.IsEnabled` последним шагом).
- **Живая проверка**: реальный заказ, мультиназначение (водитель+гид на одну строку), адресное
  снятие одного из двух — в лог `DevEmailSender` ушло письмо снятому конкретному человеку с его
  ролью; `AdminMailbox`-получатель подтверждён в перехваченном PUT-payload (не потерялся при
  сохранении); UI на 375px — без горизонтального переполнения, грид получателей карточный, RU/EN
  поля стеком.

## Настройки темы/палитры (`api/SiteSettings` — группа `Theme`) — 2026-08-13
Спецификация — `docs/specs/002-design-settings-backend.md` (+ `docs/adr/013`). Новая группа `SiteSettingGroup.Theme = 7` (не `Branding` — там только логотип):
- **`theme.activePalette`** — id активного пресета палитры сайта, тип контрола `Select` (новый `SettingValueType.Select=5`), допустимые значения — код-каталог `ThemePaletteCatalog` (не миграция): `obsidian` (дефолт, «Обсидиан + золото») и `basalt` («Базальт и медь», см. `client-site.md` — НЕ дефолт). Сервер валидирует значение против `definition.Options` (код 2013 при недопустимом).
- **`theme.defaultMode`** — `dark`/`light`, мягкий дефолт для новых посетителей; существующий клиентский переключатель темы не убирается.
- **`branding.authImageUrl`** (группа `Branding`, `sortOrder: 26`) — URL фото для сплит-экрана `/auth`, тот же паттерн, что `hero.imageUrl`/`branding.logoUrl`.
- **`theme.navStyle`** (`sortOrder: 27`, 2026-08-13) — стиль шапки+нижней мобильной навигации публичного сайта: `pill` (дефолт, текущее плавающее меню) / `rail` («Стеклянная лента» — полноширинная панель со скролл-блюром). Тот же класс решения, что `theme.activePalette` — админ выбирает готовый визуальный вариант, реализация обоих живёт во фронте. Ключ намеренно остался в `Theme`, а не в новой группе: решение backend-architect — это переиспользование механизма ADR 013, не новая сущность, отдельного ADR не заводилось (см. комментарий над записью в `SiteSettingCatalog.cs`).

Новых сущностей/репозиториев/миграции не потребовалось — всё укладывается в уже существующий каталог-в-коде `SiteSettingCatalog` (ADR 002).

## Загрузка изображений (`api/Upload`) — 2026-08-15
Второй способ заполнить те же `ImageUrl`-строковые поля, что раньше принимали только URL руками (тур `mainImageUrl`, `Place.imageUrl`/`Place.Images[].url`, `TourDay.Gallery[].url`, настройки `hero.imageUrl`/`branding.logoUrl`/`seo.ogImageUrl`/`branding.authImageUrl`) — контракт этих полей не менялся, они по-прежнему просто строка-URL. Ни новой сущности, ни миграции: загруженный файл просто возвращает URL, который фронт кладёт в то же поле, что раньше заполнялось руками.

| Метод | Route | Тело / параметры | Возврат |
| --- | --- | --- | --- |
| POST | `api/Upload/Image` | `multipart/form-data`, поле `file` | `{ url: string }` |

- **Доступ**: `[Authorize(Roles = TourManagerOrAdmin)]` — та же граница, что у Tour/Place Create/Update (тур-менеджер должен уметь загрузить фото прямо из формы тура/точки, не только Admin).
- **Валидация**: content-type только `image/jpeg`/`image/png`/`image/webp` (400 `UploadContentTypeNotAllowed`=2301), размер ≤ 8 МБ по умолчанию (400 `UploadFileTooLarge`=2300, плюс `[RequestSizeLimit]` на контроллере), нечитаемый файл (400 `UploadInvalidImage`=2302). Лимиты — `UploadSettings` (`appsettings.json` секция `Upload`), не хардкод.
- **Хранение**: локальный диск (`ATTours.BusinessServices.Files.ImageUploadService`, SkiaSharp — не ImageSharp, лицензия MIT, важно для коммерческого проекта), путь — `UploadSettings.StoragePath` (по умолчанию `uploads/` рядом с приложением, в Docker — `/app/uploads`, смонтирован volume'ом, см. `server-ops.md`). Раздача — `/uploads/*`, в проде nginx отдаёт файлы с диска напрямую, минуя .NET; `UseStaticFiles` в `Startup.cs` — только для локальной разработки, где nginx нет.
- **Что сохраняется на каждую загрузку — ДВА файла, одно имя**: оригинал (EXIF-ориентация применена, длинная сторона ≤ `MaxOriginalDimension`=4000px) под тем же расширением, что и вход, и WebP-сжатая копия (`CompressedMaxDimension`=1600px, качество `WebpQuality`=75) **рядом, тем же basename** — фронт получает в ответе только URL оригинала, WebP-парную ссылку по конвенции строит сам (`url.replace(/\.[^./]+$/, '.webp')`, `shared/lib/adaptiveImage.ts`) — это НЕ часть JSON-контракта, а голая договорённость по неймингу файлов на диске, так что схема `ImageUrl`-полей нигде не менялась ради второй ссылки.
- **EXIF-ориентация** применяется вручную (SkiaSharp декодирует "как лежит в файле") — без этого портретные фото с телефона ложились бы на бок.
- Бэкап/удаление осиротевших файлов при замене/удалении записи — сознательно НЕ реализовано (отложено), см. `tech-debt.md`.

## Теги (`api/Tag`) — 2026-08-16, декоративные
Мерч-теги продукта ("Хит сезона", …) — каталог отдельной сущностью `Tag` (+ `TagTranslation`, + join `TourTag`), тот же паттерн, что `ExpenseTemplate`/`TourNoteTemplate` (3.4). Фронт — `admin-panel.md#справочники-admincatalog`, `client-site.md#мерч-теги-2026-08-16-декоративные`.

**`TagType`**: только `Regular=1` — `Discount` убран из enum в Фазе 3 (2026-08-16, `checklist-orders-redesign.txt`), скидка тура больше не тег, см. «Скидка тура» ниже.
**`TagColor`**: `Gold=1`, `Wine=2`, `Success=3`, `Danger=4`, `Warning=5` — preset-токены сайтовой палитры, не свободный hex.

**Правила** (`TourValidationService.ValidateTagsAsync`, работает и на create, и на update): максимум 3 тега на тур, без дублей `TagId`, все `TagId` должны существовать.

`TourInfoModel.Tags`/`TourCardModel.Tags` — плоская проекция (`TourTagInfoModel { Id, TagId }`), как `Regions`: без вложенного тега, каталог (имя/цвет) фронт резолвит одним запросом к `api/Tag`. Тот же null/`[]`-контракт на `UpdateTour`, что у `Regions`.

| Метод | Route | Доступ | Возврат |
| --- | --- | --- | --- |
| GET | `api/Tag/GetAll` | TourManagerOrAdmin | `TagInfoModel[]` |
| POST | `api/Tag/Create` | Admin | `TagInfoModel` |
| PUT | `api/Tag/Update` | Admin | `TagInfoModel` |
| DELETE | `api/Tag/Delete?id=` | Admin | — (400 `CatalogEntryInUse`/2010, если назначен туру) |
| GET | `api/Tag/GetForClient?languageCode=` | анонимный | `TagInfoModel[]` (одна локаль) |

**Коды ошибок**: `TagNotFound=2023`, `TooManyTags=2024` (>3 на тур). `MultipleDiscountTags=2025` убран вместе с типом `Discount` — код переиспользован под `InvalidTourDiscount` (см. ниже).

## Скидка тура — 2026-08-18
Три поля напрямую на `Tour`, не тег: `DiscountPercent` (decimal? 1–100), `DiscountStartDate` (DateOnly?), `DiscountValidUntil` (DateOnly?) — во всех тур-DTO (`TourInfoModel`, `TourCreateModel`, `TourCardModel`), JSON-имена `discountPercent`/`discountStartDate`/`discountValidUntil` (`"YYYY-MM-DD"`).

**Правило** (`TourValidationService.ValidateDiscount`): все три поля заданы или все три `null`; `DiscountStartDate <= DiscountValidUntil` (равенство разрешено). Нарушение → 400, `InvalidTourDiscount=2025`.

**Резолв активности** (`TourDiscountExtensions`, статический хелпер в `ATTours.Common`): скидка активна на дату D, если `DiscountStartDate <= D <= DiscountValidUntil` включительно.
- `IsDiscountActive(percent, start, end, onDate = null)`
- `ResolveActiveDiscountPercent(percent, start, end, onDate = null)` / `.ResolveActiveDiscountPercent(this Tour, onDate = null)`
- `ApplyDiscount(price, activeDiscountPercent)` — возвращает `null`, если скидка не активна (контракт «`DiscountedPrice == null` = скидки нет»; до 2026-08-18 здесь была ошибка — возвращалась исходная цена, и `DiscountedPrice` был не-null у ЛЮБОГО тура).

`onDate` не передаётся → используется сегодняшняя дата (`DateTime.UtcNow`). Два разных вызова с разным `onDate`:
- **Витрина** (`MappingProfile`, `TourInfoModel.DiscountedPrice`/`TourCardModel`) — `onDate` не передаётся, резолв на сегодня. `TourCardModel` дополнительно скрывает `DiscountStartDate`/`DiscountValidUntil`, если скидка не активна сегодня (будущая акция не анонсируется на карточке).
- **Заказ** (`OrderCreationService`, `OrderLineService`) — `onDate` = дата САМОГО ТУРА (`tourDate`/`model.TourDate`), не дата оформления заказа. До 2026-08-18 оба места не передавали `onDate` вообще → резолвилось по дате заказа, и бронь на день вне диапазона скидки всё равно получала скидку. Исправлено.

### Скидка в заказе (`OrderCreationService`/`OrderLineService`)
Снапшот скидки живёт на `OrderLine` (не на `OrderPayment` — та схема ушла вместе с переделкой B14/multi-line заказов, `checklist-orders-redesign.txt`): `OrderLine.DiscountPercent` (`decimal?`, `null` — скидки не было), `PriceSnapshot` (исходная цена, не сниженная), `LineTotal` (итог по строке с учётом скидки и группового тарифа, discount-then-tier). Последующая правка/удаление скидки тура не меняет задним числом уже оформленную бронь. Видно в админке — карточка строки заказа, см. `admin-panel.md`.

**Миграции**: `AddTagsAndOrderDiscount` (2026-08-15) — таблицы `Tag`/`TagTranslation`/`TourTag`; `TourDiscountFields` (2026-08-16) — `Tour.DiscountPercent`/`DiscountValidUntil`; `AddTourDiscountStartDate` (2026-08-18) — `Tour.DiscountStartDate`.

## Гибкая система ролей и прав (`api/Roles`, `api/Screens`) — 2026-08-22
Полная архитектура — `architecture-flexible-roles.md`. Заменяет `[Authorize(Roles=...)]` на
`[RequiresPermission(AdminScreens.X, PermissionAction.Y)]` на всех фич-контроллерах (Tour,
Availability, Order-админ-методы, Place/ExpenseTemplate/TourNoteTemplate/Region/Tag,
Users-админ-методы, SiteSettings, Upload).

- **Сущности**: `UserRole` эволюционировала (`Description→Name`, `Type` стал `RoleType?` —
  `null` у кастомных ролей, влияет ТОЛЬКО на Employee-эндпоинт, ни на что больше), новые
  `RolePermission` (RoleId, ScreenKey, **`AccessLevel Level`**), `UserPermissionOverride`
  (UserId, ScreenKey, **`AccessLevel? Level`** — `null` = наследовать от роли).
- **Реестр экранов** — `ATTours.Common/Authorization/AdminScreens.cs`, 13 строковых ключей (не
  enum — ключи с точкой-неймспейсом типа `catalog.places`), включая `roles`/`notifications`.
  Единственное место, которое трогают при добавлении нового экрана (без миграций схемы, без
  правок ядра авторизации — см. §5 архитектурного документа).
- **Эндпоинты**:
  - `GET/POST/PUT/DELETE api/Roles`, `GET api/Screens` — гейтятся ключом `roles`, как любой
    другой экран (правка 22.08.2026 — были жёстко `[Authorize(Roles=Admin)]`, отвязаны от
    RoleType по прямому требованию Давида: ни одна роль не должна быть привилегированной кодом).
  - `GET/PUT api/Users/{id}/PermissionOverrides` — персональный override, гейтится ключом
    `users` (часть экрана «Пользователи»).
  - `GET api/Auth/MyPermissions` → `MyPermissionsModel` — резолвленный набор прав по всем 13
    экранам, всегда свежий из БД (не из токена) — фронт дёргает его для мгновенной перерисовки
    гардов.
- **`UserRole.CanManageAdmins`** (правка 22.08.2026, заменяет удалённый `IsSystem`) — ролевой (не
  per-экранный) флаг: может ли роль назначать/снимать эту же способность у других ролей и
  удалять/понижать аккаунты, у которых она стоит. Ставить/снимать именно это поле может только
  SuperAdmin (`RoleCreationService`/`RoleUpdateService`, читают актёра из БД) — обычное
  редактирование роли (имя, вся остальная матрица) этому не подчиняется. `GuardRoleChange`/
  `GuardAdminAccountAsync` теперь ключуются на этот флаг, а не на `RoleType.Admin`.
  `PermissionResolutionService`: полный доступ мимо матрицы дают ТОЛЬКО SuperAdmin, не роль
  «Администратор» как таковая — её реальный доступ читается из её собственных строк
  `RolePermission` (сидированы явно, поведение сразу после миграции не меняется, но матрица
  и имя роли отныне полностью редактируемы, как у любой кастомной роли).
- **Резолвинг** — печётся в JWT (`is_admin`/`perms`-claims) в момент `Login`/`DevLogin`/
  `Refresh`; на каждый запрос БД не трогаем. Изменение прав применяется на следующей ротации
  access-токена (≤15 мин) либо мгновенно при перелогине.
- **Регресс, закрытый этой задачей**: `UserInfoModel.Role`/`UserDetailInfoModel.Role` стали
  `RoleType?` (были non-nullable) + добавлено поле `RoleName` (string) — у кастомной роли `Role`
  теперь `null`, отображаемое имя всегда в `RoleName`.
- **Коды ошибок** (`GlobalErrorCode.cs`): `RoleIsSystem=2033` (больше не бросается ни при каких
  условиях — значение оставлено занятым, не переиспользовать), `RoleInUse=2034`,
  `UnknownScreenKey=2035`, `RoleNameInvalid=2036` (сдвинуты с 2031-2034 из проектного документа —
  эти номера заняты чекаутом корзины, `OrderHasInvalidLines`/`OrderTooManyLines`, ADR 025).
- **Миграции**: `AddFlexibleRolesAndPermissions` (2026-08-22) — rename+nullable на `UserRole`,
  две новые таблицы, сид `IsSystem=true` для 4 старых ролей + матрица прав для TourManager/Admin;
  `RemoveRoleSystemLockAddCanManageAdmins` (2026-08-22, часть 2) — переименовывает
  `IsSystem`→`CanManageAdmins` (сохранив `true` только у роли 3), сидит права на `roles`/
  `notifications` для роли 3.

### Единый уровень доступа вместо 4 независимых флагов + Impersonation + Remember me (2026-08-22/23)
Спека — `docs/specs/014-permission-levels-impersonation-sessions.md` (+ Section 8 addendum),
ADR 027-030. Продукт-решение Давида: 4 независимых `CanView/CanCreate/CanUpdate/CanDelete`
заменены на один `AccessLevel Level` (None/View/Create/Update/Delete) — каждый уровень включает
всё, что ниже него (раньше только `View` был воротами, остальные три были независимы). Миграция,
создававшая старую 4-флаговую схему (`AddFlexibleRolesAndPermissions`), **отредактирована на
месте** — права никогда не были задеплоены, поэтому это безопасно (локальные БД пересозданы).

- **JWT claim** — один символ уровня на экран (`products:U`) вместо подмножества букв
  (`products:VCU`); экраны на `None` в claim не попадают. `AdminScreens.CapLevel`/
  `IsAssignableLevel` — не всякий уровень применим к любому экрану (напр. `calendar` без Update).
  Уровень, не входящий в допустимые для экрана, отклоняется на 400 (`InvalidPermissionLevel=2037`
  ), а не тихо коэрсится, как раньше.
- **`UserRole.CanImpersonate`** — новый ролевой флаг (не привязан к `is_admin`/SuperAdmin),
  меняется только SuperAdmin, как и `CanManageAdmins`. Дан claim `can_impersonate` в JWT.
- **`POST api/Users/{id}/Impersonate`** — вход админа под целевым пользователем. Гварды по
  порядку: not-found → self (`CannotImpersonateSelf=2217`) → эскалация привилегий, не-SuperAdmin
  не может имперсонировать SuperAdmin/`CanManageAdmins`/`CanImpersonate`-носителя
  (`ImpersonationTargetNotAllowed=2218`) → заблокирован (`AccountLocked=2201`, переиспользован) →
  email не подтверждён (`EmailNotVerified=2202`, переиспользован). При успехе: все refresh-токены
  импersonator'а отзываются, целевому пользователю выдаётся новая сессия
  (`RefreshToken.ImpersonatedByUserId` проставлен, `RememberMe=false`), пишется аудит-запись
  `ImpersonationEvent` (кто/кого/когда/IP/UA). Обратной кнопки «вернуться в админа» нет по
  дизайну — конец сеанса имперсонации это обычный логаут + повторный вход.
- **Мгновенный kill access-токена импersonator'а** (ADR 030) — ранее открытый риск («стейтлес
  15-минутный JWT не убить мгновенно») закрыт: `IAccessTokenRevocationRegistry`, in-memory
  `ConcurrentDictionary<userId, cutoffUtc>` (backend — один инстанс на netcup VPS, поэтому
  in-memory достаточно, интерфейс существует специально ради безболезненного перехода на
  `IDistributedCache`, если появятся реплики). Пишется в `AuthService.ImpersonateAsync`,
  читается первым шагом в `RequiresPermissionAttribute`/`RequiresAnyPermissionAttribute`/новом
  `RequiresImpersonateAttribute` — токен с `iat` до cutoff получает 401, даже если формально ещё
  не истёк. **Важно**: `JwtTokenService` раньше не эмитил `iat` вообще (библиотека его не
  добавляет по умолчанию) — без явного `EpochTime.GetIntDate()` в клеймах эта проверка 401'ила бы
  и легитимный релогин impersonator'а. Исправлено при реализации, не в спеке изначально.
- **Remember me** — `LoginModel.RememberMe`, refresh-токен теперь со скользящим окном:
  `RememberMe ? 14 дней : 1 час`, пересчитывается при каждой ротации. Существующий чек
  `ExpiresAtUtc <= now` в `RefreshAsync` закрывает и inactivity-таймаут — новой логики не
  потребовалось. Миграция `AddImpersonationAndRememberMe` (2026-08-22) ретроактивно выставляет
  всем существующим refresh-токенам `RememberMe=0` и обрезает `ExpiresAtUtc` до ≤1 часа от
  деплоя — намеренный побочный эффект: все активные сессии переходят на реального пользователя в
  течение часа и заодно получают свежие права (закрывает практическую боль «права применяются
  только на ротации токена» для всей базы разом, а не только для тех, кому права поменяли).
- **Вне скоупа**: жёсткий немедленный revoke сессий при обычной смене прав вне impersonation
  (только impersonation получил мгновенный kill); роль `Employee` и её `GetAssignedToMe`;
  блокировка impersonation для юзеров с истёкшим email-verification токеном сверх уже описанной
  проверки.

## Session/device management + grace-период ротации refresh-токена — 2026-08-29

Причина: «активная сессия сбрасывается сама по себе» без Remember Me — race двух вкладок/
устройств за один истекающий access-токен. Reuse-detection в `AuthService.RefreshAsync` гасила
ВСЮ семью refresh-токенов на любое повторное предъявление уже ротированного токена. Спека —
`docs/specs/017-session-management-and-refresh-grace.md`, обоснование — ADR
[033](adr/033-refresh-token-rotation-grace-period.md).

- **`RefreshToken.CreatedByUserAgent`** (nullable, 512, миграция `AddRefreshTokenCreatedByUserAgent`)
  — заполняется на `Login`/`DevLogin`/`RefreshToken`/`Impersonate` из уже захваченного
  `RequestContextModel.UserAgent` (раньше просто не сохранялся).
- **Grace-период на reuse-detection** (`AuthService.RefreshAsync`, `RefreshReuseGraceSeconds = 10`)
  — предъявленный токен различается по `ReplacedByTokenHash`: `null` = явно погашен (logout/
  revoke/смена пароля) → 401 без гашения семьи; заполнен = умер РОТАЦИЕЙ → в течение 10с и если
  непосредственный преемник (один хоп) ещё жив, вызывающего «догоняют» новой ротацией от головы
  цепочки вместо кражи-реакции. Вне окна или с мёртвой головой — прежнее поведение (гасит всё).
  Прощённая ветка **перепроверяет** `IsDeleted`/`LockedUntil`/`IsEmailVerified` тем же порядком,
  что обычная ротация (решение 2026-08-29, не в исходной спеке) — иначе блокировка/удаление
  аккаунта внутри окна могла бы не сработать немедленно.
- **Session management** — `AuthService`, без отдельного Info-сервиса (это auth-мутация, ADR
  005/028, а не read-only сущность как `LoginHistory`):
  - Свои сессии: `GET/DELETE api/Auth/Sessions`, `POST api/Auth/Sessions/RevokeOthers`
    (`[Authorize]`, текущая сессия при revoke-others не трогается — сверка по хешу cookie).
  - Чужие сессии (админ): `GET api/Users/{id}/Sessions` (`Users`/`View`),
    `DELETE api/Users/{id}/Sessions/{sessionId}`, `POST api/Users/{id}/Sessions/RevokeAll`
    (`Users`/`Update`). Владение сессией по id проверяется на сервере — чужая/несуществующая
    строка отвечает 404 `RelationalEntityNotFound`, как и в самообслуживании.
  - `RevokeAllUserSessionsAsync` щадит **собственную impersonation-сессию вызывающего админа**
    над этой же целью (`actingUserId` + новый параметр `spareImpersonationByUserId` на
    `RevokeAllRefreshTokensAsync`) — решение 2026-08-29 по прямому запросу Давида: иначе кнопка
    «завершить все сессии» на карточке пользователя, которого сам админ сейчас имперсонирует
    (в другой вкладке/устройстве), сносила бы и его собственный рабочий сеанс. Точечный отзыв
    одной сессии по id этому правилу не подчиняется — явный выбор конкретной строки, не бланковый.
  - Новый DTO `SessionInfoModel` (`ATTours.Common/DTO/Auth`) — устройство/IP/гео/даты/`IsCurrent`
    (`IsCurrent` всегда `false` в админском списке — у админа нет cookie цели для сравнения).
- **Фронтенд** (Web Locks + новые экраны) — `client-site.md`/`admin-panel.md`.

## Трансферы, формат продукта и время старта — 2026-08-29

Батч «Трансферы + формат продукта + время старта» (`docs/checklists/checklist-transfers-format-2026-08-29.txt`).
Доменная часть — `product-model.md`; здесь только контракт.

### Новые поля на существующих контрактах
- `TourCreateModel`/`TourInfoModel`: `Format` (`TourFormat?`), `GroupPricePerPerson` (decimal?),
  `GroupCapacity` (int?), `StartTimes` (`{Time, SortOrder}`), `TransferRoutePoints`
  (`{Kind, SortOrder, Translations}`), `TransferPrices` (`{VehicleClassId, OneWayPrice,
  RoundTripPrice}`). `TourCardModel` отдаёт `Format` и `GroupPricePerPerson` — карточке нужен
  бейдж формата и цена за человека.
- Все три коллекции реконсилятся `UpdateTour` по тому же правилу «по Id», что и остальной граф;
  скалярные `Format`/`GroupPricePerPerson`/`GroupCapacity` дописаны в `TourUpdateService`
  **вручную** — там поля копируются перечислением, и не дописанное поле молча не сохраняется.

### Справочник классов авто (`api/VehicleClass`)
Право — `catalog.vehicle-classes` (новый ключ в `AdminScreens`, полный CRUD). Структура ровно как
у `api/Tag`.

| Метод | Route | Тело / параметры | Возврат |
| --- | --- | --- | --- |
| GET | `GetAll` | — | `VehicleClassInfoModel[]` (`OrderBy(SortOrder)`) |
| POST | `Create` | `VehicleClassCreateModel` | `VehicleClassInfoModel` |
| PUT | `Update` | `VehicleClassInfoModel` | `VehicleClassInfoModel` (перечитанный) |
| DELETE | `Delete?id=` | — | — (400 `CatalogEntryInUse`/2010, если класс в `TransferPrice`/`OrderLine`) |
| GET | `GetForClient?languageCode=` | — (анонимный) | `VehicleClassInfoModel[]` (только `IsActive`, одна локаль) |

`VehicleClass`: `Capacity` (мест без водителя), `LuggageCapacity` (единиц багажа), `SortOrder`,
`IsActive` + переводы названия RU/EN. Класс, который уже используется, скрывают флагом, а не
удаляют (FK `Restrict` + гард в сервисе удаления).

### Публичные трансферы (`api/Transfer`)
Оба метода анонимные. Админский CRUD трансфера остаётся в `TourController` — трансфер это
`TourType`, а не отдельная сущность; отдельный контроллер существует только потому, что публичная
read-модель другая (маршрут и цены по классам вместо дней, регионов и тегов).

| Метод | Route | Тело / параметры | Возврат |
| --- | --- | --- | --- |
| GET | `GetTransfersClient?languageCode=` | — | `TransferCardModel[]` (`{Id, MainImageUrl, Translations, RoutePoints, MinOneWayPrice}`) |
| GET | `GetTransferInfo?id=&languageCode=` | — | `TransferInfoModel` (`{Id, MainImageUrl, RequiresPrepayment, Translations, RoutePoints, Prices}`) |

`TransferPriceClientModel` — `{VehicleClassId, VehicleClassName, Capacity, LuggageCapacity,
SortOrder, OneWayPrice, RoundTripPrice}`: две цены приходят отдельными числами, «туда-обратно»
не выводится из «в одну сторону». Черновик/архив отвечают 404 так же, как несуществующий id —
иначе по ответу можно было бы узнать о существовании неопубликованного продукта (то же правило,
что в `GetTourInfo`).

### Доступность: места группового формата и закрытые даты
| Метод | Route | Тело / параметры | Возврат |
| --- | --- | --- | --- |
| GET | `api/Availability/GetGroupSeats?tourId=&from=&to=` | — (анонимный) | `TourGroupSeatsModel` |
| GET | `api/Availability/GetClosedDates?tourId=&from=&to=&tourType=` | — (анонимный) | `DateOnly[]` |

- `TourGroupSeatsModel` — `{TourId, Format, Capacity, Slots[]}`, слот `{Date, StartTime,
  BookedSeats, SeatsLeft}`. **В `Slots` попадают только слоты с бронями**: отсутствие даты
  означает «свободно всё», а не «выезда нет» (фронт разбирает это в `shared/booking/groupSeats.ts`).
  Живёт рядом с закрытыми датами, а не в деталях продукта: ответка продукта кэшируется и не знает
  диапазона дат.
- `GetClosedDates`: `tourId` стал **nullable**, добавлен необязательный `tourType` (решение 0.27) —
  у конструктора кастомной заявки продукта нет вовсе, и он спрашивает по типу
  (`GetClosedDates?tourType=3`). Когда `tourId` задан, тип берётся из БД, а `tourType` из запроса
  игнорируется.

### Область правил закрытия «тип продукта» + 6 рангов приоритета
`ClosureRule.TourType` (`TourType?`) — третья область действия рядом с «весь сайт» и «один
продукт»: закрыть день **только для трансферов**, не трогая туры и экскурсии. Взаимоисключима с
`TourId` (`ClosureRuleValidationService`); оба `null` = глобальное правило, как и раньше.

Почему колонка, а не фронтовый пресет, раскладывающий выбор в N tour-scope правил: материализованный
список id замораживает состав каталога на момент нажатия — трансфер, заведённый завтра, в такое
закрытие уже не попал бы. Тип продукта — это правило, а не выборка.

`ClosureRuleResolver` (см. ADR 012) получил сигнатуру `IsClosed/Resolve(rules, date, tourId,
tourType)` и **6 рангов** специфичности вместо 4 — новая область вставлена между туром и глобальной,
порядок ADR 012 внутри каждой области сохранён:

| Ранг | Область | Тип правила |
| --- | --- | --- |
| 6 | Tour | SpecificDate |
| 5 | Тип продукта | SpecificDate |
| 4 | Global | SpecificDate |
| 3 | Tour | Weekly |
| 2 | Тип продукта | Weekly |
| 1 | Global | Weekly |

`tourType == null` в запросе означает «тип неизвестен/не важен» — правила типовой области тогда не
применяются, глобальные и tour-scope работают как раньше. Тай-брейк по `Id` при равном ранге
остался прежним. Проверка закрытых дат добавлена трансферу (обе даты — поездки и обратного рейса)
и кастомной заявке. Фронтовая копия резолвера (ADR 015,
`features/admin/calendar/lib/closureResolver.ts`) обновлена теми же шестью рангами.

### Заказы: статус «Заявка» и расширение строки
`OrderStatus += Request = 8` — заявка без цены: кастомный трансфер, собранный клиентом в
конструкторе, `LineTotal == 0`, цену проставляет менеджер уже в админке, после чего заказ идёт по
обычному флоу.

`OrderLine`:
- `TourId` стал **nullable** — `null` ровно тогда, когда `LineKind == CustomTransfer`;
- `LineKind` (`OrderLineKind`) — явное поле, а не вывод из «`TourId == null`»;
- `StartTime` (`TimeOnly?`) — выбранный слот у тура/экскурсии, время подачи у трансфера. Снапшот,
  а не FK: правка расписания продукта не меняет уже оформленную бронь. Nullable только ради строк,
  созданных до батча;
- `Format` (`TourFormat?`) — снапшот выбора клиента, по нему считался `LineTotal`. Пишется всегда,
  а не только при `Both`;
- `IsRoundTrip` (bool) + `ReturnDate` (`DateOnly?`) + `ReturnTime` (`TimeOnly?`) — обратный рейс
  трансфера; при `IsRoundTrip == false` обе величины `null`;
- `VehicleClassId` (int?) + `VehicleClassNameSnapshot` (string) — класс авто и снапшот его названия
  (RU) на момент брони, тот же принцип, что у `PriceSnapshot`;
- `CustomTransferDetails` — 1:1, заполнено ровно при `LineKind == CustomTransfer`:
  `{PassengerCount, LuggageMediumCount, LuggageLargeCount, LuggageOther, DesiredVehicleClassId,
  Comment, Stops[]}`; `CustomTransferStop { Kind, SortOrder, Text }` — маршрут заявки
  **одноязычный**, ровно в том виде, в каком его ввёл клиент.

Расчёт `LineTotal` (`OrderCreationService` + общий `OrderLinePricing`):
- Individual — как раньше (фикс + тир по числу гостей), скидка резолвится на дату поездки до тира;
- Group — `GroupPricePerPerson` × гости, без тиров;
- Transfer — цена класса авто, `OneWayPrice` либо `RoundTripPrice` по `IsRoundTrip`.

### `POST api/Order/CreateTransferRequest`
`[Authorize]` без ролей, владелец — из токена: заявка это не анонимная форма обратной связи, по ней
будут звонить и её будут превращать в заказ. Тело — `CustomTransferRequestCreateModel`
(`{PickupDate, PickupTime, IsRoundTrip, ReturnDate, ReturnTime, PassengerCount,
LuggageMediumCount, LuggageLargeCount, LuggageOther, DesiredVehicleClassId, Comment, Stops[]}`),
ответ — обычный `OrderInfoModel`. Отдельный маршрут, а не флаг в `Create`: у заявки нет ни корзины,
ни цены, ни продукта — общего тела запроса с чекаутом у неё не существует. Уведомление уходит тем
же каналом, что у обычной брони (`SendOrderCreatedAsync`), и пишется событие в журнал заказа.

### Новые коды ошибок (`GlobalErrorCode`, 2044–2059)
Заказная половина 2044–2049 приходит пер-строчно (`OrderLinesErrorModel.lines[].errorCode`) при
чекауте корзины и плоско — при добавлении строки админом и при отправке заявки.

| Код | Имя | Смысл |
| --- | --- | --- |
| 2044 | `NoSeatsLeft` | Свободных мест на слоте (тур + дата + время старта) меньше, чем просит строка. Занято = Σ `GuestCount` по строкам всех заказов на слоте, кроме `Rejected` |
| 2045 | `InvalidStartTimeSelection` | Время старта не выбрано или не входит в расписание продукта — свободный ввод не принимается |
| 2046 | `OrderLineFormatRequired` | У продукта `Format == Both`, а строка не сказала, какой формат выбрал клиент |
| 2047 | `VehicleClassNotAvailable` | Бронь трансфера без класса авто либо с классом, у которого на этом трансфере нет цены (в отличие от 2057 — класс существует, но не продаётся) |
| 2048 | `LuggageExceedsVehicleCapacity` | Багаж (средний ×3 + большой ×5) не влезает в `LuggageCapacity` выбранного класса. Проверяется, только если багаж заполнен и класс выбран |
| 2049 | `PassengersExceedVehicleCapacity` | Пассажиров больше вместимости выбранного класса |
| 2050 | `InvalidTourFormat` | Формат отсутствует у тура/экскурсии либо задан у трансфера |
| 2051 | `InvalidGroupPricing` | `Group`/`Both` без цены за человека или без мест на выезд |
| 2052 | `InvalidTourStartTimes` | У тура/экскурсии ни одного времени старта либо у трансфера они есть |
| 2053 | `InvalidTransferRoute` | В маршруте трансфера не ровно одна точка `From` и не ровно одна `To` |
| 2054 | `InvalidTransferPrices` | У трансфера нет ни одного класса с ценой либо какая-то из двух цен не положительна |
| 2055 | `TransferFieldNotAllowed` | Прислано поле, которого у трансфера не бывает (дни, галерея, регионы, теги, скидка, заметки, доп.расходы) |
| 2056 | `TransferMainImageRequired` | У трансфера нет главной картинки |
| 2057 | `VehicleClassNotFound` | Такого класса нет в справочнике |
| 2058 | `InvalidReturnTrip` | Обратный рейс заказан, но без своей даты/времени либо раньше самой поездки |
| 2059 | `RequiredFieldMissing` | Обязательное поле пустое — русское название продукта, главная картинка, русское название дня, название класса авто. Один код на все: сообщение называет конкретное поле |

2059 — результат аудита паритета валидации фронт↔бэк (общее правило проекта: всё, что валидируется
на фронте, обязано валидироваться и на бэке; фронтовая валидация это UX, а не защита от прямых
запросов к API). Лимит 16 гостей зеркалится для брони продукта, но не для кастомной заявки —
у заявки «пассажиров больше, чем вмещает любая машина» это штатный путь в заявку без цены, а не
ошибка.

## Контакты для связи с клиентом (`api/Account/Contacts`) — 2026-08-29

Спека `specs/016-client-contacts-backend.md`, решения — `adr/032-order-contact-as-value-snapshot.md`.

**Две сущности, а не одна.** `UserContactMethod` — справочник в профиле. `OrderContact` — снимок
значений В ЗАКАЗЕ, **без FK на справочник**: правка или удаление контакта в профиле не должны
менять уже созданный заказ, там обязан остаться номер, по которому договаривались. Вариант
«копия + необязательная ссылка на оригинал» отклонён: живую ссылку рано или поздно прочитают как
актуальное значение.

Поля обеих: `Type` (`ContactMethodType`: 1 Phone, 2 WhatsApp, 3 Telegram, 4 Viber, 5 Email),
`Value`, `FirstName` (обязательно), `LastName` (**nullable**, с 2026-08-29), `IsPrimary`.
У `OrderContact` дополнительно `SortOrder`; у `UserContactMethod` — индекс по `UserId`.

### Эндпоинты справочника (self-service, userId только из токена)
| Метод | Маршрут | Что делает |
| --- | --- | --- |
| GET | `api/Account/Contacts` | Весь справочник, **основной первым** — порядок задаёт сервер, фронт не пересортировывает |
| POST | `api/Account/Contacts` | Создаёт; первый контакт становится основным всегда |
| PUT | `api/Account/Contacts` | Правит. Снять флаг «основной» этим вызовом НЕЛЬЗЯ (обрабатывается только `false → true`), иначе в справочнике не осталось бы основного |
| DELETE | `api/Account/Contacts?id=` | Физическое удаление — безопасно, в заказах лежит снимок |
| PATCH | `api/Account/Contacts/SetPrimary?id=` | Возвращает справочник **целиком**: смена основного меняет флаг у двух записей и порядок списка |

### В заказах
Новых эндпоинтов нет: контакты приезжают в существующих телах `Order/Create` и
`Order/CreateTransferRequest` (поле `Contacts`) и возвращаются в `OrderInfoModel.Contacts`
(основной первым) в `{id}`, `GetAll`, `GetMine`, `GetAssignedToMe`.

Правило «минимум 1, максимум 3, ровно один основной» живёт в `OrderValidationService`, а не в
сервисах создания: так его получит и будущий админский сервис создания заказа. Применяется
только к собираемому заказу (`Id == 0`) — на пути правки (`OrderUpdateService`) коллекция
контактов не выгружена, и проверка там валила бы любую правку любой брони.

Валидация значения (`ContactMethodValidator`, зеркалится на фронте): телефон/WhatsApp/Viber —
`^\+\d{8,15}$`; Email — адрес; Telegram — `@username` или номер. Ведущий `+` обязателен и
сервером НЕ дописывается: `89261234567` — российский трунк, а не `+8…`.

### Токен письма
`{{ClientContact}}` — HTML-токен (третий после `OrderLines` и `AssignmentDetails`), выдаётся
событиям `OrderCreated`, `OrderAssignEmployee`, `OrderAutoCancelled`. `OrderSendToClient` его НЕ
получает: письмо адресовано самому клиенту. В Telegram — plaintext-зеркало, стоит ПЕРЕД составом
заказа, потому что сообщение режется по лимиту с конца.

### Коды ошибок
`2060 OrderContactRequired`, `2061 OrderTooManyContacts`, `2062 OrderPrimaryContactInvalid`,
`2063 InvalidContactValue`, `2064 ContactMethodNotFound`, `2065 TooManyContactMethods`.

## Личные предпочтения (`api/Account/Preferences`) — 2026-08-29

`GET` / `PUT`, self-service. Четыре новых поля на `User` + существовавший `PreferredLanguage`.

**`null` = «личного выбора нет, следуй дефолту сайта», а не «пусто».** Сервер сознательно не
подмешивает дефолты: фронт и так получает `theme.defaultMode` / `theme.activePalette` из
публичных настроек, а различать «выбрано dark» и «выбора нет» обязательно — иначе смена
админского дефолта перестанет действовать на тех, кто ничего не выбирал.

**`PUT` — полная перезапись, а не патч.** `null` в поле означает «сбросить к дефолту сайта».
Семантику «не менять» здесь заводить нельзя: тогда сброс темы к дефолту станет невыразимым.

| Поле | Значения |
| --- | --- |
| `PreferredTheme` | `"dark"` / `"light"` / `null` |
| `PreferredPalette` | id пресета из `ThemePaletteCatalog` / `null` |
| `PreferredCurrency` | ISO-4217 из каталога валют / `null` |
| `PreferredLanguage` | не nullable; он же — язык уведомлений |
| `NotificationChannels` | флаги `Email = 1`, `Telegram = 2`; ноль запрещён |

Отказы: `2068` — пустая маска каналов, `2069` — Telegram без привязанного чата, `2070` —
неизвестная тема/палитра/валюта.

## Миграции
Актуальные (в `ATTours.DataLayer/Migrations`): `InitialCreate`, `AddRoutePoint`, `AddOrganizationalDetailAndRestriction`, `ChangeTourDayChildrenToCascade`, `AddTourIsArchived`, `AddSiteSettings`, `AddRegionAndTourRegion`, `SeedArmenianRegions`, `MergeRestrictionAndOrganizationalDetailIntoTourNote`, `AddReferenceCatalogs`, `AddTourFeatured`, `SeedRegionBlurbs`, `AddExchangeRate`, `AddOrdersAndClosureRules`, `AddTourRequiresPrepayment` (2026-08-13 — `Tour.RequiresPrepayment`, `bit NOT NULL DEFAULT 1`; см. `product-model.md`), `AddClosureRuleBatchId` (2026-08-14 — `ClosureRule.BatchId`, `uniqueidentifier NULL`; см. выше), `AddTagsAndOrderDiscount` (2026-08-15), `TourDiscountFields` (2026-08-16), `AddTourDiscountStartDate` (2026-08-18 — см. «Скидка тура» выше), `AddFlexibleRolesAndPermissions` (2026-08-22 — отредактирована на месте 2026-08-23, чтобы сразу эмитить `AccessLevel Level` вместо 4 bool-флагов; права никогда не были задеплоены, редактирование существующей миграции безопасно), `RemoveRoleSystemLockAddCanManageAdmins` (2026-08-22), `AddImpersonationAndRememberMe` (2026-08-22 — `UserRole.CanImpersonate`, `RefreshToken.RememberMe`/`ImpersonatedByUserId`, таблица `ImpersonationEvent`, ретроактивный флаш существующих refresh-токенов). Миграции применяются автоматически при старте backend (с retry, с 2026-08-10) — отдельного ручного шага `dotnet ef database update` в проде не требуется.

Батч трансферов (2026-08-29), три миграции подряд:
- `20260829092657_AddTransfersProductFormatAndStartTimes` — `Tour.Format`/`GroupPricePerPerson`/
  `GroupCapacity`, таблицы `TourStartTime`, `VehicleClass`(+`Translation`), `TransferRoutePoint`
  (+`Translation`), `TransferPrice`, `CustomTransferDetails`, `CustomTransferStop`, новые колонки
  `OrderLine` (+ `TourId` → nullable). Данные: `UPDATE [Tour] SET [Format] = 1 WHERE [Type] IN (1, 2)`
  и одно посеянное время `09:00` каждому существующему туру/экскурсии — чтобы старые продукты не
  стали нередактируемыми на полпути.
- `20260829110424_AddClosureRuleProductTypeScope` — `ClosureRule.TourType` (nullable).
- `20260829110546_RemoveSeededDefaultStartTimes` — ровно один
  `DELETE FROM [TourStartTime] WHERE [Time] = '09:00:00'` (решение 0.28: время старта строго
  обязательно, посеянное значение убирается, реальное расписание админ заводит руками). Продукты и
  заказы не тронуты, `Down` пустой.

Батч контактов и предпочтений (2026-08-29, вечер), четыре миграции:
- `20260829144713_AddClientContacts` — таблицы `UserContactMethod` и `OrderContact`
  (обе с каскадом от владельца), индексы по `UserId` / `OrderId`.
- `20260829152927_AddUserPreferences` — четыре колонки на `User`; `NotificationChannels`
  не nullable с `defaultValue: 1` (бэкфилл существующих строк = Email). Дефолт задан в
  миграции, а не в `UserConfiguration`: `HasDefaultValue` пометил бы колонку
  `ValueGeneratedOnAdd`, а CLR-дефолт этого enum — запрещённое значение `None`.
- `20260829161407_MakeContactLastNameOptional` — два `AlterColumn`, фамилия стала
  необязательной. Отдельной миграцией, а не правкой `AddClientContacts`: та уже могла
  примениться к локальной базе, и правка файла там просто не сработала бы.
- `20260829173505_AddClientContactToOrderTemplates` — только `migrationBuilder.Sql`:
  дописывает блок «Связь с клиентом» с токеном `{{ClientContact}}` в боевые шаблоны событий
  1, 2 и 5, идемпотентно (`NOT LIKE`). `BodyHtmlEn` — только если перевод непустой: пустой EN
  означает «письмо уйдёт русской версией» (ADR 026), и один английский абзац превратил бы
  «перевода нет» в «перевод есть».

**Известный пробел в этом списке**: миграции переделки B14/multi-line заказов (`checklist-orders-redesign.txt`, между 08-16 и 08-16) в список не занесены — Фаза 12 (docs) той работы была осознанно пропущена по просьбе пользователя. Список неполный между `AddOrdersAndClosureRules` и `AddTagsAndOrderDiscount`.
