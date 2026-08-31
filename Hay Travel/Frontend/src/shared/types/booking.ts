/**
 * Wire types for orders, closure rules and the availability calendar — a 1:1 mirror of the
 * backend contract, in the same deliberately "dumb" DTO style as `shared/types/attours.ts`.
 *
 * Unlike `attours.ts` (admin-only), these live in `shared/types` because BOTH sides consume them:
 * the admin calendar reads `CalendarMonthModel`/`ClosureRuleInfoModel`, and the public booking
 * card posts `OrderCreateModel` and reads back `OrderInfoModel`. A feature cannot import another
 * feature's types, so anything two features share has to sit here.
 *
 * Dates are STRINGS, never `Date`. Two independent reasons:
 *  - `OrderLine.TourDate` and every `ClosureRule` date are `DateOnly` server-side — a wall-clock
 *    calendar day, with no time and no timezone. `Date` cannot represent that without inventing
 *    an instant.
 *  - `new Date('2026-07-27')` parses as UTC midnight, which local-renders as the 26th anywhere
 *    west of UTC (see `shared/lib/date.ts`'s `parseISODate`). Keeping the wire shape as
 *    `YYYY-MM-DD` strings means that trap can only be hit by explicitly calling the wrong parser.
 * `createdAtUtc`/`approvedAtUtc` are the exception: they ARE instants, and arrive as ISO-8601 UTC
 * timestamps.
 *
 * Enums are frozen const objects + a value-union (`erasableSyntaxOnly` forbids TS `enum` — same
 * convention as `features/admin/lib/enums.ts` and `shared/auth/types.ts`).
 *
 * `EmployeeJobRole` (Задача D) is imported, not redeclared here, from its own zero-import leaf
 * (`shared/types/employeeRole.ts`) — `shared/auth/types.ts`'s `User.defaultJobRole` needs the same
 * type, and neither of these two leaf modules imports the other.
 *
 * ── Order became multi-line (ADR 019, 2026-08-16) ─────────────────────────────────────────────
 * `Order` is now a header (status/number/owner/currency) over a list of `OrderLine`s, each
 * carrying its own tour/date/guests/money/employee/fulfillment details. `OrderPayment` became a
 * ledger of transactions per line, not a 1:1 money snapshot of the whole order (see ADR 019).
 *
 * ── The public site posts a MULTI-LINE order too (ADR 025, 2026-08-22) ────────────────────────
 * `OrderCreateModel` used to be a single flat `{ tourId, tourDate, guestCount }`, because a public
 * booking was always exactly one line. The cart ended that: the whole cart becomes ONE order with
 * N lines, created atomically by one request (`{ lines: [...] }`). A rejection of any single line
 * creates nothing at all and comes back as `OrderLinesErrorModel` — top-level `errorCode` 2031
 * plus a per-line breakdown. `OrderLineCreateModel` (admin "add a line to an existing order")
 * is a different endpoint and is unaffected.
 *
 * ── Мульти-исполнители на строке (редизайн 2026-08-23) ────────────────────────────────────────
 * У строки заказа больше нет одного исполнителя: плоские `employeeId`/`employeeRole`/
 * `pickupDetails`/`navigatorLink` заменены списком `employees: OrderLineEmployeeInfoModel[]`
 * (0..N), и «детали для выполнения» — у каждого исполнителя свои, плюс двуязычный комментарий.
 * Следом переписаны и запросы: `OrderLineUpdateModel` похудел до предоплаты, назначение стало
 * мультивыбором с аддитивной upsert-семантикой, снятие — адресным по `employeeId`, а правку
 * деталей одного исполнителя делает новый `OrderLineEmployeeUpdateModel`.
 */

import type { OrderContactInput, OrderContactModel } from './contact'
import type { EmployeeJobRole } from './employeeRole'
import type { LanguageCode } from './language'
import type { TourFormat } from './tourFormat'

export const OrderStatus = {
  /** Just created (site booking OR added manually in admin), no line requires prepayment yet. */
  Open: 1,
  /** On hold: line editing is disabled, only deletion is available. */
  Hold: 2,
  /** Approved by an admin. */
  Approved: 3,
  /** Rejected. Editing is disabled, only deletion is available. `rejectReason` explains why. */
  Rejected: 4,
  /** Approved and prepayment percentages are set on the lines — ready to assign employees. */
  ReadyForAssignment: 5,
  /** Created and at least one line requires prepayment — waiting for it before moving on. */
  PendingPayment: 6,
  /** Fulfilled ("Завершить" action). */
  Completed: 7,
  /** Заявка без цены (батч «Трансферы + формат», 2026-08-29): кастомный трансфер, собранный
   * клиентом в конструкторе. Каждая её строка — `OrderLineKind.CustomTransfer` с `lineTotal === 0`;
   * цену проставляет менеджер (`OrderLineUpdateModel.lineTotal`), после чего заказ идёт по
   * обычному флоу. НЕ «до-решения»-статус вроде `Open`: заявку как раз и нужно править до
   * одобрения, иначе одобрять было бы нечего. */
  Request: 8,
} as const

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

/** One entry of an `OrderLine`'s money ledger — a transaction, not a snapshot (ADR 019). */
export const OrderPaymentType = {
  Prepayment: 1,
  Payment: 2,
} as const

export type OrderPaymentType = (typeof OrderPaymentType)[keyof typeof OrderPaymentType]

export const ClosureRuleType = {
  /** One concrete calendar date (`date` set, `dayOfWeek` null). */
  SpecificDate: 1,
  /** Repeats on a weekday, optionally bounded by `effectiveFrom`/`effectiveTo`. */
  Weekly: 2,
} as const

export type ClosureRuleType = (typeof ClosureRuleType)[keyof typeof ClosureRuleType]

export const ClosureAction = {
  Close: 1,
  /** An exception that re-opens a day an overlapping rule closed (ADR 012 precedence). */
  Open: 2,
} as const

export type ClosureAction = (typeof ClosureAction)[keyof typeof ClosureAction]

/** `System.DayOfWeek` — Sunday = 0 … Saturday = 6. NOT the Monday-first grid index used by
 * `mondayFirstWeekday`/`getMonthGrid` in `shared/lib/date.ts`; converting between the two is a
 * per-call-site concern and is done explicitly wherever both appear. */
export const DayOfWeekCode = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
} as const

export type DayOfWeekCode = (typeof DayOfWeekCode)[keyof typeof DayOfWeekCode]

/* -------------------------------------------------------------------------- */
/*  Orders                                                                     */
/* -------------------------------------------------------------------------- */

/** One transaction in an `OrderLine`'s money ledger (ADR 019 — replaces the old 1:1
 * `OrderPaymentInfoModel` snapshot). Has its own addressable `id` and human `number` (`PP` +
 * digits, server-generated). */
export interface OrderPaymentInfoModel {
  id: number
  orderLineId: number
  type: OrderPaymentType
  number: string
  amount: number
  /** ISO-8601 UTC instant. */
  createdAtUtc: string
}

/** Один исполнитель на одной строке заказа (редизайн 2026-08-23). Заменяет плоские
 * `employeeId`/`employeeRole`/`pickupDetails`/`navigatorLink`, которые были на самой строке:
 * у строки теперь 0..N исполнителей, и «детали для выполнения» — у каждого свои.
 * `id` — идентификатор ЭТОЙ связки (`OrderLineEmployee`), не строки и не пользователя;
 * именно он адресует `PUT api/Order/UpdateLineEmployee`. */
export interface OrderLineEmployeeInfoModel {
  id: number
  employeeId: number
  /** Денормализовано сервером — второй запрос за именем не нужен. */
  employeeFullName: string | null
  /** Снапшот роли на момент назначения. Назначения без роли не существует. */
  employeeRole: EmployeeJobRole
  /** «Где забрать клиента». `null`/пусто — поле НЕ появится ни в PDF, ни в письме. */
  pickupDetails: string | null
  /** Ссылка на навигатор/карты. Правило пустоты — то же. */
  navigatorLink: string | null
  /** Свободный комментарий исполнителю, RU-версия. */
  comment: string | null
  /** EN-версия комментария. Пусто — англоязычному исполнителю уйдёт `comment`. */
  commentEn: string | null
}

/** Одна остановка маршрута кастомной заявки — одноязычный свободный текст, ровно как его ввёл
 * клиент (перевода у него нет и быть не может). Порядок — `From` → `Stop` по `sortOrder` → `To`,
 * сервер отдаёт список уже отсортированным. */
export interface CustomTransferStopInfoModel {
  id: number
  /** `TransferRoutePointKind`: 1 = From, 2 = Stop, 3 = To. Число, а не импорт из
   * `features/admin/lib/enums.ts`: `shared` не может зависеть от `features`, и это ровно тот же
   * приём, которым `shared/types/attours.ts` описывает `TransferRoutePointInfoModel.kind`. */
  kind: number
  sortOrder: number
  text: string
}

/** Детали кастомной заявки на трансфер (батч 2026-08-29) — заполнено РОВНО у строки с
 * `lineKind === OrderLineKind.CustomTransfer`, `null` у брони продукта.
 *
 * Дата/время подачи, обратный рейс и число гостей здесь НЕ дублируются: они на самой строке, как
 * и у обычной брони. */
export interface CustomTransferDetailsInfoModel {
  id: number
  passengerCount: number
  luggageMediumCount: number
  luggageLargeCount: number
  /** Свободный текст «другое» — то, что не описывается двумя счётчиками (велосипед, коляска…). */
  luggageOther: string | null
  /** Багаж в «единицах» (средний = 3, большой = 5, решение 0.13) — считает СЕРВЕР, чтобы админка
   * и публичный конструктор не пересчитывали курс каждый по-своему. */
  luggageUnits: number
  /** Пожелание клиента, а не бронь класса: цену и фактический транспорт согласует менеджер. */
  desiredVehicleClassId: number | null
  /** Денормализовано сервером — экран заказа не ходит в справочник классов отдельным запросом. */
  desiredVehicleClassName: string | null
  comment: string | null
  stops: CustomTransferStopInfoModel[]
}

/**
 * One line of an order — its own tour/date/guests/money/fulfillment details (ADR 019).
 * `tourTitle`/`tourMainImageUrl` are denormalized server-side so the list and detail screens never
 * need a second request to resolve them.
 *
 * ── Строка перестала быть обязательно «строкой по продукту» (батч 2026-08-29) ─────────────────
 * У заявки кастомного трансфера продукта НЕТ: `tourId === null`, `lineKind === CustomTransfer`, а
 * маршрут и пожелания лежат в `customTransferDetails`. Читать нужно `lineKind`, а не
 * `tourId === null` — отсутствие продукта это следствие типа строки, а не его определение.
 */
export interface OrderLineInfoModel {
  id: number
  /** `OrderLineKind`: 1 = Product, 2 = CustomTransfer. Число по той же причине, что `kind` выше. */
  lineKind: number
  /** `null` ровно у строки-заявки — всё, что ведёт на карточку продукта, обязано это учитывать. */
  tourId: number | null
  /** Already resolved to a language server-side: RU in the admin list/detail. У заявки сервер
   * подставляет осмысленную подпись («Кастомный трансфер»), а не пустоту. */
  tourTitle: string | null
  tourMainImageUrl: string | null
  /** `DateOnly` on the wire — `YYYY-MM-DD`, NOT an ISO timestamp. */
  tourDate: string
  /** `TimeOnly` on the wire — `"HH:mm:ss"`. Выбранный слот тура/экскурсии либо время подачи
   * трансфера; `null` у строк, созданных до появления слотов. */
  startTime: string | null
  /** По какому формату посчитана строка — снапшот выбора клиента, когда продукт продаётся в
   * обоих. `null` у трансфера и у строк, созданных до батча. */
  format: TourFormat | null
  guestCount: number

  /** Обратный рейс трансфера со своей датой и временем; у тура/экскурсии всегда `false`. */
  isRoundTrip: boolean
  /** `YYYY-MM-DD`; непусто только при `isRoundTrip`. */
  returnDate: string | null
  /** `"HH:mm:ss"`; непусто только при `isRoundTrip`. */
  returnTime: string | null

  vehicleClassId: number | null
  /** Снапшот названия класса на момент брони: переименование класса в справочнике не должно
   * менять уже подтверждённую бронь. */
  vehicleClassNameSnapshot: string | null

  /** Заполнено ровно у строки-заявки (`lineKind === CustomTransfer`), `null` у брони продукта. */
  customTransferDetails: CustomTransferDetailsInfoModel | null

  requiresPrepayment: boolean
  prepaymentAmount: number

  /** Base product price at the moment this line was added, BEFORE any discount: за бронь целиком
   * (индивидуальный формат), ЗА ЧЕЛОВЕКА (групповой) либо цена выбранного класса авто (трансфер).
   * У заявки продукта нет — здесь `0`, пока менеджер не проставит `lineTotal` (сервер тогда
   * приравнивает снапшот к согласованной сумме). */
  priceSnapshot: number
  /** Snapshot of the tour's discount percent at that moment, `null` — no discount was applied. A
   * later edit/removal of the tour's discount never changes this retroactively. */
  discountPercent: number | null
  /** `priceSnapshot` with `discountPercent` applied — this line's contribution to `Order.total`. */
  lineTotal: number

  /** 0..N исполнителей строки. Пустой список — строка не назначена. */
  employees: OrderLineEmployeeInfoModel[]

  payments: OrderPaymentInfoModel[]
}

/** The order header — status/number/owner/currency plus its lines. Money/tour/date all live on
 * `OrderLineInfoModel` now (ADR 019); `discountTotal`/`total` are aggregates the SERVER computes
 * over the lines, so the frontend never re-sums the grid on every render. */
export interface OrderInfoModel {
  id: number
  /** DDMMYY + a 4-digit daily counter (resets every day) — the human-facing order number, shown
   * everywhere instead of `id`. */
  number: string
  userId: number
  /** Denormalized for the admin list — no second request to resolve the customer. */
  userEmail: string
  userFullName: string
  /** Язык клиента — тем же полем сервер выбирает языковую версию письма «Клиенту заказа». */
  userPreferredLanguage: LanguageCode
  status: OrderStatus
  /** Only meaningful while `status === Rejected`; `null` otherwise. */
  rejectReason: string | null
  /** ISO-8601 UTC instant. */
  createdAtUtc: string
  /** ISO-8601 UTC instant. `null` until the order is first set to `Approved`. */
  approvedAtUtc: string | null
  currency: string

  lines: OrderLineInfoModel[]

  /**
   * Контакты для связи по этому заказу, ОСНОВНОЙ ПЕРВЫМ (порядок задаёт сервер, фронт не
   * сортирует — та же гарантия, что у справочника профиля).
   *
   * Это СНИМОК значений на момент оформления, а не ссылки на справочник (ADR 032 Р1): правка или
   * удаление контакта в профиле уже созданный заказ не трогает, поэтому здесь `OrderContactModel`,
   * а не `ContactMethodModel`.
   *
   * Пустой массив — законное значение: у заказов, созданных до батча 2026-08-29, контактов нет и
   * бэкфилла не было, так что любой рендер обязан переживать пустой список.
   */
  contacts: OrderContactModel[]

  /** Sum of each line's snapshot-price × discount — server-computed aggregate. */
  discountTotal: number
  /** Sum of `lines[].lineTotal` — server-computed aggregate. */
  total: number
}

/** `PUT api/Order/Update` payload — a visitor editing THEIR OWN booking (always one line), only
 * while `status` is `Open`/`PendingPayment`. `id` is the `Order.id`, not a line id — editing a
 * specific line of an admin-built multi-line order is a different endpoint
 * (`OrderLineUpdateModel`). `tourId` is not editable: a different tour is a different order. */
export interface OrderUpdateModel {
  id: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
}

/** Одна позиция корзины в теле `POST api/Order/Create` (spec 013). */
export interface OrderCreateLineModel {
  tourId: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
  /** Выбранный слот выезда, `"HH:mm:ss"` (`TimeOnly` на бэке — см. `shared/booking/startTime.ts`).
   * Обязан быть ОДНИМ ИЗ `TourDetail.startTimes` продукта: свой ввести нельзя (решение 0.21),
   * чужое значение бэк отбивает `InvalidStartTimeSelection`/2045. У ТРАНСФЕРА это, наоборот,
   * свободное время подачи — расписания у него нет, но поле так же обязательно (решение 0.9). */
  startTime: string
  /** `TourFormat` — выбор посетителя. Обязателен, только когда продукт продаётся в обоих
   * форматах (`Both`), иначе бэк значение игнорирует и формат продукта не переопределяется.
   * `null` при `Both` — отказ `OrderLineFormatRequired`/2046. У трансфера формата нет — `null`. */
  format: TourFormat | null

  /* ── Поля ТРАНСФЕРА (батч 2026-08-29) ────────────────────────────────────────────────────
     Опциональны, потому что позиция по туру/экскурсии их не посылает вовсе, а бэк у не-трансфера
     их всё равно не сохраняет (`OrderCreateLineModel` на сервере). */

  /** Обратный рейс со СВОЕЙ датой и временем (решение 0.12), а не «плюс N часов». При `true`
   * обе даты обязательны и не могут быть раньше поездки — иначе `InvalidReturnTrip`/2058. */
  isRoundTrip?: boolean
  /** `YYYY-MM-DD`. */
  returnDate?: string | null
  /** `"HH:mm:ss"`. */
  returnTime?: string | null
  /** Класс авто из цен этого трансфера: его цена и ЕСТЬ цена строки, поэтому у трансфера поле
   * обязательно (`VehicleClassNotAvailable`/2047), а пассажиров больше вместимости класса —
   * `PassengersExceedVehicleCapacity`/2049. */
  vehicleClassId?: number | null
}

/** `POST api/Order/Create` (ADR 025). Создаёт ОДИН заказ с N строками, атомарно: либо все строки,
 * либо ни одной. No `userId`: сервер берёт владельца из токена, никогда из тела (IDOR guard).
 * 1..10 строк; пустой список — 2028, больше десяти — 2032. */
export interface OrderCreateModel {
  lines: OrderCreateLineModel[]
  /**
   * С кем связаться по этому заказу: 1..3 контакта, ровно один основной (батч 2026-08-29).
   *
   * Обязательное поле, а не опциональное: пустой список сервер отбивает `OrderContactRequired`/2060,
   * больше трёх — 2061, основной не ровно один — 2062. Все три приходят ПЛОСКО, не в массиве
   * `lines`: контакт — свойство заказа целиком.
   *
   * Уезжает СНИМКОМ значений, без ссылки на строку справочника профиля (ADR 032 Р1) — поэтому
   * правка или удаление контакта в кабинете не меняет уже созданные заказы.
   */
  contacts: OrderContactInput[]
}

/** Один пункт пер-строчного отказа валидации. `index` — 0-based позиция строки В ОТПРАВЛЕННОМ
 * массиве `lines`, порядок сервер сохраняет. */
export interface OrderLineErrorItem {
  index: number
  /** `null` у строки без продукта (`OrderLineKind.CustomTransfer`) — с корзины это недостижимо,
   * она шлёт только `tourId`, но контракт `OrderLineErrorItem.TourId` стал nullable вместе со
   * строкой заказа, и читатель обязан это выдержать, а не отбрасывать такой пункт. */
  tourId: number | null
  /** `YYYY-MM-DD`. */
  tourDate: string
  /** Пер-строчный `GlobalErrorCode`: 2004 / 2014 / 2015 / 2016. */
  errorCode: number
}

/** Тело ответа 400 при `errorCode === 2031` (`OrderHasInvalidLines`) — расширение обычного
 * `ErrorModel` массивом строк. Отказ ФОРМЫ запроса (2028 / 2032) приходит обычным `ErrorModel`
 * без `lines`. */
export interface OrderLinesErrorModel {
  httpStatusCode: number
  message: string
  errorCode: number
  lines: OrderLineErrorItem[]
}

/**
 * Одна точка маршрута кастомной заявки в теле `POST api/Order/CreateTransferRequest`.
 *
 * Одноязычная: это ровно тот текст, который ввёл клиент (перевода у него нет и быть не может),
 * в отличие от точки предопределённого трансфера, которую админ заводит на двух языках.
 */
export interface CustomTransferStopCreateModel {
  /** `TransferRoutePointKind`: 1 = From, 2 = Stop, 3 = To. Число по той же причине, что и у
   * `CustomTransferStopInfoModel.kind` выше: `shared` не зависит от `features`. */
  kind: number
  /** Порядок промежуточных точек (drag-n-drop). У From/To значения не имеет — сервер всё равно
   * пересобирает порядок сам (`CustomTransferRequestCreationService.BuildStops`). */
  sortOrder: number
  text: string
}

/**
 * `POST api/Order/CreateTransferRequest` — кастомная заявка из конструктора (решения 0.11-0.14).
 *
 * Отдельная модель, а НЕ `OrderCreateModel` с особой строкой: у заявки нет продукта, нет цены и
 * нет корзины — она всегда ровно одна позиция и создаёт заказ в статусе `Request`. Всё, что
 * определяет деньги, статус и владельца, задаёт сервер: цена 0, предоплаты нет, `userId` из
 * токена. Требует авторизации (`authFetch`).
 *
 * Отказы, которые видит фронт: `InvalidTransferRoute`/2053 (нет «откуда»/«куда» или пустой
 * текст точки), `InvalidReturnTrip`/2058, `VehicleClassNotFound`/2057,
 * `PassengersExceedVehicleCapacity`/2049, `LuggageExceedsVehicleCapacity`/2048,
 * `TourDateUnavailable`/2014 (день закрыт правилом «весь сайт» или «все трансферы»),
 * `OrderDateInPast`/2016, `InvalidStartTimeSelection`/2045 (не указано время подачи).
 */
export interface CustomTransferRequestCreateModel {
  /** `YYYY-MM-DD`. */
  pickupDate: string
  /** `"HH:mm:ss"`. Формально nullable на бэке, чтобы отличить «не прислали» от полуночи, —
   * но заявка без времени подачи отбивается (2045). */
  pickupTime: string | null
  isRoundTrip: boolean
  /** `YYYY-MM-DD`. */
  returnDate: string | null
  /** `"HH:mm:ss"`. */
  returnTime: string | null
  passengerCount: number
  /** Штуки, а не «единицы»: перевод в единицы (средний = 3, большой = 5) делает СЕРВЕР, чтобы
   * курс не пересчитывался в двух местах по-разному. */
  luggageMediumCount: number
  luggageLargeCount: number
  /** Нестандартный багаж свободным текстом; в единицы не переводится. */
  luggageOther: string
  /** ПОЖЕЛАНИЕ, а не бронь класса: цену и машину согласует менеджер. `null` — «подберите сами»
   * (в том числе когда пассажиров больше вместимости любого класса, решение 0.14). */
  desiredVehicleClassId: number | null
  comment: string
  /** Ровно одна точка `From`, 0..N `Stop`, ровно одна `To`. */
  stops: CustomTransferStopCreateModel[]
  /**
   * Контакты для связи: 1..3, ровно один основной (спека 016). Пустой список — отказ
   * `OrderContactRequired`/2060: заявка уходит без цены, и единственное, что делает её
   * выполнимой, — возможность позвонить. Брать номер из профиля молча нельзя: заказ часто
   * оформляют не на себя.
   */
  contacts: OrderContactInput[]
}

/**
 * `POST api/Order/AddLine` — admin adds a line to an existing order.
 *
 * Батч «Трансферы + формат» (2026-08-29): те же поля выбора, что и у брони с сайта — админская
 * строка считается по тому же правилу (`OrderLinePricing`) и проходит ту же проверку мест, иначе
 * групповой выезд можно было бы перебронировать из админки. Кастовая заявка этим эндпоинтом НЕ
 * создаётся: у неё нет продукта (`api/Order/CreateTransferRequest`).
 */
export interface OrderLineCreateModel {
  orderId: number
  tourId: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
  requiresPrepayment: boolean
  prepaymentAmount: number

  /** `"HH:mm:ss"` (`TimeOnly` на бэке — приводит `shared/booking/startTime.ts`).
   *  - тур/экскурсия: ОДНО из `TourInfoModel.startTimes` продукта, своё значение бэк отбивает
   *    `InvalidStartTimeSelection`/2045; при групповом формате обязательно (по нему считается
   *    остаток мест);
   *  - трансфер: свободное время подачи, обязательно (2045). */
  startTime?: string | null
  /** `TourFormat` — обязателен, только когда у продукта `format === Both`; иначе бэк значение
   * игнорирует и формат продукта не переопределяется. `null` при `Both` — 400
   * (`OrderLineFormatRequired`/2046). */
  format?: TourFormat | null

  /** Обратный рейс — только у трансфера; у тура/экскурсии бэк поля не сохраняет. Дата и время
   * обязательны при `true` и не могут быть раньше самой поездки (`InvalidReturnTrip`/2058). */
  isRoundTrip?: boolean
  /** `YYYY-MM-DD`. */
  returnDate?: string | null
  /** `"HH:mm:ss"`. */
  returnTime?: string | null

  /** Класс авто из цен трансфера (`TourInfoModel.transferPrices`). Обязателен у трансфера
   * (`VehicleClassNotAvailable`/2047); гостей больше вместимости класса — 2049. */
  vehicleClassId?: number | null
}

/** `PUT api/Order/UpdateLine` — admin edits one line's prepayment, and nothing else. «Детали для
 * выполнения» переехали на исполнителя (`OrderLineEmployeeUpdateModel`, редизайн 2026-08-23), а
 * назначение всегда было отдельным эндпоинтом (`OrderAssignEmployeeModel`) со своей bulk-логикой. */
export interface OrderLineUpdateModel {
  id: number
  requiresPrepayment: boolean
  prepaymentAmount: number
  /** Цена, которую менеджер согласовал по кастомной заявке (решение 0.11 — заявка приходит с
   * нулём). `null`/опущено — «не трогать сумму»; ноль — осмысленное «пока не согласована»,
   * поэтому поле nullable, а не 0.
   *
   * Работает ТОЛЬКО на строке-заявке (`lineKind === CustomTransfer`). На строке по продукту сумма
   * — снапшот расчёта (ADR 019), и сервер отбивает попытку переписать её руками (400,
   * `OrderNotEditable`/2021), а не игнорирует молча. */
  lineTotal?: number | null
}

/** `PATCH api/Order/SetStatus` — replaces the old Confirm/Cancel pair (ADR 019, 7 statuses). Any
 * status is reachable from any other — this is a plain dropdown, not a state machine.
 * `rejectReason` is only read by the server when `status === Rejected`. */
export interface OrderStatusUpdateModel {
  id: number
  status: OrderStatus
  rejectReason: string | null
}

/** Один пункт мультивыбора попапа назначения. Роль обязательна: сервер отбивает 0
 * (`EmployeeRoleRequired`, 2029). */
export interface OrderAssignEmployeeItem {
  employeeId: number
  employeeRole: EmployeeJobRole
}

/** `PATCH api/Order/AssignEmployee`. `lineId: null` — на ВСЕ строки заказа.
 *
 * Семантика — АДДИТИВНЫЙ upsert, не «заменить набор»: не перечисленные здесь исполнители со
 * строки НЕ снимаются (для этого есть `unassignEmployee` с конкретным `employeeId`). Повторный
 * вызов с тем же человеком меняет ему роль и (при `sendEmail`) переотправляет письмо.
 * Пустой `employees` — 400. */
export interface OrderAssignEmployeeModel {
  orderId: number
  lineId: number | null
  employees: OrderAssignEmployeeItem[]
  /** `false` — тихое «Назначить», `true`/опущено — «Назначить и отправить письмо». Письмо
   * уходит только при совпадении намерения И включённого канала события. */
  sendEmail?: boolean
}

/** `PATCH api/Order/UnassignEmployee` (Задача D) — separate from `AssignEmployee`, not that model
 * with nullable fields: assignment's `employeeRole` stays required, this is the only way to clear
 * an assignment. Idempotent on an already-unassigned line (no error, no email, no journal entry).
 * No `sendEmail` flag — the unassignment email is governed only by the `order.unassign_employee`
 * notification-setting toggle (Задача E), there is no per-call silent variant. */
export interface OrderUnassignEmployeeModel {
  orderId: number
  /** `null` — все строки заказа. */
  lineId: number | null
  /** `null` — снять ВСЕХ исполнителей с целевых строк; задан — только этого человека.
   * Это `User.id`, а не `OrderLineEmployeeInfoModel.id`. */
  employeeId: number | null
}

/** `PUT api/Order/UpdateLineEmployee` — «детали для выполнения» ОДНОГО исполнителя ОДНОЙ строки.
 * `id` — `OrderLineEmployeeInfoModel.id`. Роль здесь не правится: её меняет assign (upsert). */
export interface OrderLineEmployeeUpdateModel {
  id: number
  pickupDetails: string | null
  navigatorLink: string | null
  comment: string | null
  commentEn: string | null
}

/** Order-history audit log entry type (`docs/specs/007-order-event-log-backend.md`) — read-only,
 * written server-side after each mutation, never posted by the client. */
export const OrderEventType = {
  Created: 1,
  StatusChanged: 2,
  Updated: 3,
  LineAdded: 4,
  LineRemoved: 5,
  LineUpdated: 6,
  EmployeeAssigned: 7,
  SentToClient: 8,
  PaymentAdded: 9,
  /** Снятие исполнителя со строки/всех строк заказа (Задача D). */
  EmployeeUnassigned: 10,
} as const

export type OrderEventType = (typeof OrderEventType)[keyof typeof OrderEventType]

/** `GET api/Order/{id}/Events` element — the "История" tab's readonly timeline. `description` is
 * a ready-to-render Russian sentence built server-side (e.g. "Статус изменён: «Открыт» →
 * «Одобрен»") — the client never reconstructs event text from `type` + raw fields, `type` is only
 * used for the small tag pill next to each row. */
export interface OrderEventInfoModel {
  id: number
  type: OrderEventType
  description: string
  actorUserId: number | null
  /** Snapshot of the actor's name AT THE TIME of the event — not re-resolved if they're renamed
   * later. `null` for system/unauthenticated-actor events, if any ever occur. */
  actorFullName: string | null
  /** ISO-8601 UTC instant. */
  createdAtUtc: string
}

/** `POST api/Order/AddPayment` — a manual ledger entry (no payment gateway; the admin records the
 * fact of payment themselves). `number` is server-generated, not accepted here. */
export interface OrderPaymentCreateModel {
  orderLineId: number
  type: OrderPaymentType
  amount: number
}

/* -------------------------------------------------------------------------- */
/*  Closure rules                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Область действия правила закрытия. Три взаимоисключающих варианта (решение 0.27 батча
 * `checklist-transfers-format-2026-08-29`), и бэк отбивает попытку задать первые два разом
 * (`InvalidClosureRule`/2017):
 *  - `tourId` задан → правило про ОДИН продукт;
 *  - `tourType` задан → правило про ВСЕ продукты этого типа, включая заведённые ПОЗЖЕ;
 *  - оба `null` → глобальное правило.
 *
 * Тип продукта здесь `number`, а не импорт `TourType` из `features/admin/lib/enums.ts`:
 * `shared` не может зависеть от `features` — ровно та же причина и тот же приём, что у
 * `CustomTransferStopInfoModel.kind` выше. Значения: 1 = тур, 2 = экскурсия, 3 = трансфер.
 */
export interface ClosureRuleScope {
  tourId: number | null
  tourType: number | null
}

export interface ClosureRuleInfoModel {
  id: number
  /** `null` = global rule, applying to every tour. */
  tourId: number | null
  /** `TourType` (1/2/3) или `null` — см. `ClosureRuleScope`. Правила, созданные до батча
   * 2026-08-29, всегда приходят с `null` и работают как работали. */
  tourType: number | null
  type: ClosureRuleType
  action: ClosureAction
  /** Set iff `type === SpecificDate`. */
  date: string | null
  /** Set iff `type === Weekly`. */
  dayOfWeek: DayOfWeekCode | null
  /** Inclusive lower bound of a `Weekly` rule; `null` = unbounded. */
  effectiveFrom: string | null
  /** Inclusive upper bound of a `Weekly` rule; `null` = unbounded. */
  effectiveTo: string | null
  /** Internal admin note. Not translatable, not shown to visitors. */
  reason: string | null
  /** Every rule created by the same `CreateRules` call (one bulk operation, or a single toggle —
   * both go through it) shares one `batchId` — the admin screen groups rows by it. `null` only
   * for rules created before this column existed (2026-08-14). */
  batchId: string | null
}

/** One element of the `POST api/Availability/CreateRules` list payload. */
export interface ClosureRuleCreateModel {
  tourId: number | null
  /** См. `ClosureRuleScope`. Отправлять вместе с непустым `tourId` нельзя — 400. */
  tourType?: number | null
  type: ClosureRuleType
  action: ClosureAction
  date?: string | null
  dayOfWeek?: DayOfWeekCode | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  reason?: string | null
}

/* -------------------------------------------------------------------------- */
/*  Availability calendar                                                      */
/* -------------------------------------------------------------------------- */

export interface CalendarDayTourOrdersModel {
  tourId: number
  orderCount: number
  /** Total guests across this tour's orders on this day. */
  guestCount: number
}

/** One day of the admin month grid. Closure flags are the server's RESOLVED answer (rules are
 * stored, not materialized — ADR 012), so the client never recomputes them for display. */
export interface CalendarDayModel {
  date: string
  isClosedGlobally: boolean
  /** Причина победившего глобального правила закрытия; `null` — день открыт, или причина не
   * указывалась. Только для глобального закрытия. */
  closureReason: string | null
  closedTourIds: number[]
  /** Типы продукта, закрытые в этот день правилом области «весь тип» (`ClosureRuleScope`),
   * когда день НЕ закрыт глобально. Значения — `TourType` (1/2/3), см. `ClosureRuleScope` о том,
   * почему это `number`, а не импортированный enum.
   *
   * Отдельный список, а НЕ развёрнутый в `closedTourIds`: правило адресует категорию, и продукт,
   * заведённый завтра, тоже попадёт под него — перечисление сегодняшних id было бы враньём. */
  closedTourTypes: number[]
  /** Sum over `ordersByTour`. Rejected orders are excluded server-side (`OrderCalendarInfo`). */
  totalOrders: number
  ordersByTour: CalendarDayTourOrdersModel[]
}

export interface CalendarMonthModel {
  year: number
  /** 1–12, as the backend sends it. `Date`'s month is 0-based — convert at the boundary. */
  month: number
  days: CalendarDayModel[]
}

/* -------------------------------------------------------------------------- */
/*  Остаток мест группового формата                                            */
/* -------------------------------------------------------------------------- */

/** Занятость ОДНОГО выезда — пары (дата + время старта). Приходит только для слотов, на
 * которых уже что-то забронировано. */
export interface TourGroupSeatsSlotModel {
  /** `YYYY-MM-DD`. */
  date: string
  /** `"HH:mm:ss"` — к каноничному `HH:mm` приводит `shared/booking/startTime.ts`. */
  startTime: string
  /** Сумма гостей по строкам заказов на этом слоте во всех статусах, кроме отклонённого. */
  bookedSeats: number
  seatsLeft: number
}

/**
 * `GET api/Availability/GetGroupSeats?tourId=&from=&to=` — остаток мест группового формата
 * (решения 0.19/0.20 чек-листа 2026-08-29). Публичный эндпоинт, как и `GetClosedDates`: блок
 * брони обязан гасить недоступные слоты ещё до логина.
 *
 * `slots` содержит ТОЛЬКО слоты С БРОНЯМИ. Отсутствие даты в списке означает «занято 0,
 * свободно `capacity`», а не «такого выезда нет»: гонять по проводу сетку «90 дней × все
 * времена старта» из одних нулей незачем.
 *
 * У индивидуального формата (а также у скрытого/несуществующего продукта) `capacity` = 0 и
 * `slots` пуст — ограничителя по местам у него не существует вовсе.
 */
export interface TourGroupSeatsModel {
  tourId: number
  /** `TourFormat` продукта; `null` у продуктов, созданных до батча. */
  format: TourFormat | null
  /** `Tour.GroupCapacity` — «мест на выезд», ОДНО число на весь продукт. */
  capacity: number
  slots: TourGroupSeatsSlotModel[]
}
