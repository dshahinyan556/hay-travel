# Spec 003 — Frontend: админ-календарь занятости + реальное бронирование

Автор: `frontend-architect`. Дата: 2026-08-11.
Статус: готово к реализации. Реализует `frontend-developer`.
Источник истины по контрактам бэкенда: [spec 001](001-booking-calendar-backend.md).
Связанные ADR: [012](../adr/012-closure-rules-stored-as-rules-not-materialized-dates.md),
[014](../adr/014-order-money-in-separate-orderpayment-entity.md),
[015](../adr/015-client-side-mirror-of-closure-rule-resolver.md),
[016](../adr/016-calendar-month-data-owned-by-feature-hook-not-route-loader.md).

Спецификация самодостаточна: по ней сразу пишется код. Открытых вопросов «на усмотрение
разработчика» нет — если ниже что-то выглядит как выбор, он уже сделан и обоснован.

---

## 0. Ориентиры — на какой существующий код равняться

| Что делаешь | Смотри в проекте |
| --- | --- |
| Экран админки: loader + guard по роли + локальный стейт + `revalidator` | `features/admin/users/UsersPage.tsx` (`usersLoader`, `redirect('/admin')`, `handleChangeRole`, баннер ошибки над контентом) |
| Экран с вкладками и одним лоадером на всё | `features/admin/catalog/CatalogPage.tsx` (`Tabs`, sticky `top-[60px]`, `revalidate` в дочерние вкладки) |
| Выезжающая панель для формы/деталей без ухода со страницы | `features/admin/ui/SidePanel.tsx` |
| Модалка подтверждения | `shared/ui/Modal.tsx` + `users/components/PromoteToAdminModal.tsx` |
| Модуль API админки (одна функция на эндпоинт, `authFetch`, шапка с ролями) | `features/admin/api/adminUsers.ts` |
| Русская копия + маппинг `errorCode` → человеческий текст | `features/admin/users/lib/userCopy.ts` (`usersErrorMessage`, `errorCodeOf`) |
| Чистая функция фильтрации/трансформации в `lib/` фичи | `features/admin/users/lib/filterUsers.ts` |
| Публичный API-модуль сайта (маппинг wire → доменная модель) | `shared/api/tours.ts` |
| Enum, разделяемый с бэкендом (`erasableSyntaxOnly` — TS `enum` запрещён) | `features/admin/lib/enums.ts`, `shared/auth/types.ts` (`RoleType`) |
| Ленивый роут админки | `app/router.tsx`, ветка `path: 'admin'` |

Правила границ, которые нельзя нарушать:
- фичи не импортируют друг друга — только через `shared` (поэтому `returnTo` переезжает в
  `shared/lib`, см. §3.6);
- админка русская, без словаря i18n; публичный сайт — только через `shared/i18n/dictionary.ts`;
- сеть в компонентах не вызывается напрямую: только через модуль `api/*` фичи или `shared/api/*`.

---

## 1. Сводка принятых решений

1. **Новая фича админки** — `features/admin/calendar/` (страница + компоненты + хук + `lib/`),
   маршрут `/admin/calendar`, пункт сайдбара «Календарь» после «Продукты».
2. **Права**: эндпоинты `api/Availability/*` и `Order/GetAll` — Admin-only, поэтому появляется
   предикат `canManageCalendar = isAdmin` в `shared/auth/permissions.ts`; TourManager раздел не
   видит и получает `redirect('/admin')` в лоадере (копия поведения `usersLoader`).
3. **Данные месяца** — хук `useCalendarMonth` с кэшем и префетчем, не route loader (ADR 016).
   Лоадер грузит только туры и правила.
4. **Планирование мутаций закрытия** — чистые функции `closureResolver.ts` + `closureToggle.ts`
   (ADR 015). Отображение состояния — только по ответу сервера.
5. **Тегов у туров в системе нет** (проверено: ни в `TourInfoModel`, ни в бэкенд-спеке).
   Поэтому «массовая операция по тегу» реализуется как: область = «Все туры» (`tourId: null`)
   ИЛИ явный мультивыбор туров, с быстрыми чипами-пресетами «Все · Туры · Экскурсии»,
   которые заполняют мультивыбор (`TourType` из `features/admin/lib/enums.ts`). Никакой новой
   сущности «тег» фронт не выдумывает.
6. **Общие wire-типы** (`Order*`, `ClosureRule*`, `Calendar*`) нужны и админке, и публичному
   сайту → живут в `shared/types/booking.ts` (новый файл рядом с `attours.ts`, тот же стиль).
7. **`DatePicker` получает `disabledDates?: ReadonlySet<string>`** — множество ISO-дат, которые
   гасятся дополнительно к `min`/`max`/`disablePast`. Не предикат-колбэк: `Set` совпадает по
   форме с ответом `GetClosedDates`, даёт O(1) на 42 клетки и требует от вызывающего ровно один
   `useMemo` (контракт стабильности ссылки задокументировать в props).
8. **Календарные хелперы дат переезжают** из приватной части `DatePicker.tsx` в
   `shared/lib/date.ts` — админ-сетке нужна ровно та же Monday-first сетка на 42 клетки; две
   реализации календарной сетки в одном приложении недопустимы.
9. **Бронь только для залогиненных**: карточка рендерится всем, но при сабмите анонимного
   пользователя показывается инлайн-блок «нужен вход» со ссылкой на `/auth?returnTo=…`,
   в `returnTo` переносятся выбранные дата и число гостей (`?date=&guests=`), которые карточка
   восстанавливает при возврате. Жёсткого редиректа при открытии страницы НЕТ (тур должен
   читаться анонимно).
10. **Закрытые даты для брони** грузит `tourDetailLoader` (не эффект в компоненте) — карточка
    остаётся презентационной по отношению к сети, как и с `largeGroupInvitation`.

---

## 2. Дерево файлов

```
src/
  shared/
    lib/date.ts                      ИЗМЕНИТЬ  (+ календарные хелперы)
    lib/returnTo.ts                  СОЗДАТЬ   (перенос из features/auth/lib/returnTo.ts)
    types/booking.ts                 СОЗДАТЬ   (wire-модели заказов/правил/календаря)
    api/booking.ts                   СОЗДАТЬ   (getClosedDates, createOrder)
    ui/DatePicker.tsx                ИЗМЕНИТЬ  (disabledDates + импорт хелперов)
    i18n/dictionary.ts               ИЗМЕНИТЬ  (новые ключи ru/en)
    auth/permissions.ts              ИЗМЕНИТЬ  (canManageCalendar)
    auth/index.ts                    ИЗМЕНИТЬ  (реэкспорт canManageCalendar)
  features/
    auth/lib/returnTo.ts             УДАЛИТЬ   (+ поправить 4 импортёра)
    tours/
      lib/bookingWindow.ts           СОЗДАТЬ
      TourDetailPage.tsx             ИЗМЕНИТЬ  (loader + проп closedDates)
      components/BookingCard.tsx     ИЗМЕНИТЬ  (реальный POST, гашение дат, авторизация)
    admin/
      api/adminAvailability.ts       СОЗДАТЬ
      api/adminOrders.ts             СОЗДАТЬ
      calendar/
        CalendarPage.tsx             СОЗДАТЬ   (страница + calendarLoader + все мутации)
        hooks/useCalendarMonth.ts    СОЗДАТЬ
        components/CalendarToolbar.tsx      СОЗДАТЬ
        components/CalendarMonthGrid.tsx    СОЗДАТЬ
        components/CalendarDayCell.tsx      СОЗДАТЬ
        components/DayDetailPanel.tsx       СОЗДАТЬ
        components/DayOrdersList.tsx        СОЗДАТЬ
        components/DayClosureControls.tsx   СОЗДАТЬ
        components/BulkClosurePanel.tsx     СОЗДАТЬ
        components/ClosureRulesTable.tsx    СОЗДАТЬ
        lib/calendarModel.ts         СОЗДАТЬ
        lib/closureResolver.ts       СОЗДАТЬ
        lib/closureToggle.ts         СОЗДАТЬ
        lib/closureRuleForm.ts       СОЗДАТЬ
        lib/calendarCopy.ts          СОЗДАТЬ
      index.ts                       ИЗМЕНИТЬ  (экспорт CalendarPage/calendarLoader)
      layout/AdminSidebar.tsx        ИЗМЕНИТЬ  (пункт «Календарь»)
  app/router.tsx                     ИЗМЕНИТЬ  (роут admin/calendar)
```

Своего `index.ts` у `calendar/` нет — подфичи админки (`users`, `catalog`, `products`) его не
имеют, наружу всё уходит через единый `features/admin/index.ts`.

---

## 3. Shared-слой

### 3.1 `shared/types/booking.ts` — СОЗДАТЬ

Wire-модели ровно по spec 001 §2.4. Стиль — как `shared/types/attours.ts` (camelCase, `| null`
там, где бэкенд nullable). Enum'ы — frozen const + value-union (`erasableSyntaxOnly`).

```ts
export const OrderStatus = { PendingConfirmation: 1, Confirmed: 2, Cancelled: 3 } as const
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

export const ClosureRuleType = { SpecificDate: 1, Weekly: 2 } as const
export type ClosureRuleType = (typeof ClosureRuleType)[keyof typeof ClosureRuleType]

export const ClosureAction = { Close: 1, Open: 2 } as const
export type ClosureAction = (typeof ClosureAction)[keyof typeof ClosureAction]

/** `System.DayOfWeek` — Sunday = 0 … Saturday = 6. НЕ путать с Monday-first индексом сетки. */
export const DayOfWeekCode = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
} as const
export type DayOfWeekCode = (typeof DayOfWeekCode)[keyof typeof DayOfWeekCode]

export interface OrderPaymentInfoModel {
  tourPriceSnapshot: number
  totalAmount: number
  prepaidAmount: number
  currency: string
}

export interface OrderInfoModel {
  id: number
  userId: number
  userEmail: string
  userFullName: string
  tourId: number
  tourTitle: string
  tourMainImageUrl: string | null
  /** `DateOnly` на проводе — строка `YYYY-MM-DD`, НЕ ISO-timestamp. */
  tourDate: string
  guestCount: number
  status: OrderStatus
  /** ISO-8601 UTC. */
  createdAtUtc: string
  payment: OrderPaymentInfoModel
}

export interface OrderCreateModel {
  tourId: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
}

export interface ClosureRuleInfoModel {
  id: number
  /** `null` = правило глобальное (все туры). */
  tourId: number | null
  type: ClosureRuleType
  action: ClosureAction
  date: string | null
  dayOfWeek: DayOfWeekCode | null
  effectiveFrom: string | null
  effectiveTo: string | null
  reason: string | null
}

export interface ClosureRuleCreateModel {
  tourId: number | null
  type: ClosureRuleType
  action: ClosureAction
  date?: string | null
  dayOfWeek?: DayOfWeekCode | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  reason?: string | null
}

export interface CalendarDayTourOrdersModel {
  tourId: number
  orderCount: number
  guestCount: number
}

export interface CalendarDayModel {
  date: string
  isClosedGlobally: boolean
  closedTourIds: number[]
  totalOrders: number
  ordersByTour: CalendarDayTourOrdersModel[]
}

export interface CalendarMonthModel {
  year: number
  /** 1–12, как у бэкенда. В `Date` месяц 0-based — конвертировать на границе. */
  month: number
  days: CalendarDayModel[]
}
```

Шапка файла: пояснить, что это wire-shape (как `attours.ts`), что он общий для админки и
публичного сайта, и почему `tourDate`/`date` — строки, а не `Date` (см. `shared/lib/date.ts`
про UTC-ловушку `new Date('YYYY-MM-DD')`).

### 3.2 `shared/api/booking.ts` — СОЗДАТЬ

```ts
/** Публичная доступность + создание заказа. Маппинга wire→домен здесь нет намеренно:
 *  формы совпадают (см. шапку). */

/** Публичный эндпоинт (без `[Authorize]`) — плоский список закрытых для тура дат `YYYY-MM-DD`
 *  в диапазоне включительно. Порядок и дубликаты не гарантируются — вызывающий кладёт в `Set`. */
export function getClosedDates(tourId: number, from: string, to: string): Promise<string[]>
//  apiFetch<string[]>(`api/Availability/GetClosedDates?tourId=${tourId}&from=${from}&to=${to}`)

/** Требует авторизации: `UserId` берётся из токена, в теле его нет. */
export function createOrder(model: OrderCreateModel): Promise<OrderInfoModel>
//  authFetch<OrderInfoModel>('api/Order/Create', { method: 'POST', body: JSON.stringify(model) })
```

- `getClosedDates` идёт через `apiFetch` (`shared/lib/http`), `createOrder` — через `authFetch`
  (`shared/auth`). Это единственный модуль в `shared/api/*`, который смешивает оба, — объяснить
  в шапке одной строкой.
- Никаких `try/catch` внутри: политику ошибок задаёт вызывающий (лоадер/карточка).

### 3.3 `shared/lib/date.ts` — ИЗМЕНИТЬ

Перенести из приватной части `shared/ui/DatePicker.tsx` (удалив их оттуда) без изменения тел:

```ts
export function isBeforeDay(a: Date, b: Date): boolean
export function isAfterDay(a: Date, b: Date): boolean
export function isSameDay(a: Date, b: Date): boolean
export function addDays(date: Date, delta: number): Date
export function startOfMonth(date: Date): Date
/** 0 = понедельник … 6 = воскресенье (native `getDay()` — Sunday-first). */
export function mondayFirstWeekday(date: Date): number
/** Всегда 42 клетки (6 недель), чтобы сетка не «прыгала» между месяцами. */
export function getMonthGrid(viewMonth: Date): Date[]
```

Добавить новыми:

```ts
/** Последний день месяца. */
export function endOfMonth(date: Date): Date
/** Все дни диапазона включительно, по возрастанию. `from > to` → `[]`. */
export function eachDayInRange(from: Date, to: Date): Date[]
```

Обновить шапку файла: убрать абзац «Grid-only helpers … deliberately stay private», заменить
объяснением, что сетку теперь строят двое (`DatePicker` и админ-календарь), поэтому хелперы
общие. Поведение `DatePicker` не меняется ни на пиксель — только импорты.

### 3.4 `shared/ui/DatePicker.tsx` — ИЗМЕНИТЬ

1. Убрать локальные копии хелперов из §3.3, импортировать их из `@/shared/lib/date`.
2. Новый проп:

```ts
  /**
   * Дополнительно погашенные даты (`YYYY-MM-DD`), сверх `min`/`max`/`disablePast` — например
   * дни, закрытые для брони. ВАЖНО: ссылка должна быть стабильной (`useMemo` на стороне
   * вызывающего) — она входит в зависимости мемоизации `isDisabledDate`.
   */
  disabledDates?: ReadonlySet<string>
```

3. `isDisabledDate`: после существующих проверок добавить
   `if (disabledDates?.has(formatISODate(date))) return true`; `disabledDates` добавить в
   массив зависимостей `useCallback`.
4. Различать «просто недоступно» и «закрыто»: завести локальный
   `const isUnavailable = (date: Date) => disabledDates?.has(formatISODate(date)) === true`
   и для таких клеток
   - добавить к классам `line-through` (поверх текущей disabled-палитры, обе ветки
     `isAdmin`/public),
   - дописать к `aria-label` суффикс `, ${t('datePicker.unavailable')}`.
   Прочие disabled-клетки (прошлое, вне `min`/`max`) выглядят как сейчас.
5. Клетки остаются фокусируемыми (`aria-disabled`, не `disabled`) — существующий контракт
   роверинга не трогать.

### 3.5 `shared/i18n/dictionary.ts` — ИЗМЕНИТЬ

Добавить в обе секции (`ru` и `en`), рядом с блоком `booking.*`:

| Ключ | ru | en |
| --- | --- | --- |
| `datePicker.unavailable` | `недоступно` | `unavailable` |
| `booking.authTitle` | `Нужен вход в аккаунт` | `Sign in to book` |
| `booking.authBody` | `Бронирование доступно только авторизованным гостям — так мы сможем показать вам статус заказа.` | `Booking is available to signed-in guests only, so you can track your order.` |
| `booking.authAction` | `Войти и продолжить` | `Sign in and continue` |
| `booking.submitting` | `Отправляем…` | `Sending…` |
| `booking.dateUnavailable` | `Эта дата уже недоступна — выберите другую.` | `That date is no longer available — please pick another.` |
| `booking.datePast` | `Эта дата уже прошла — выберите другую.` | `That date is in the past — please pick another.` |
| `booking.submitFailed` | `Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.` | `Could not send the request. Check your connection and try again.` |
| `booking.sessionExpired` | `Сессия истекла — войдите заново, чтобы завершить бронь.` | `Your session expired — sign in again to finish booking.` |
| `booking.orderNumber` | `Заказ №{id}` | `Order #{id}` |
| `booking.submittedTitleConfirmed` | `Бронь подтверждена` | `Booking confirmed` |
| `booking.submittedBodyConfirmed` | `Мы написали вам на почту. Детали и предоплата — по договорённости с менеджером.` | `We've emailed you. Details and the deposit are arranged with your manager.` |

Существующие `booking.submittedTitle`/`booking.submittedBody` НЕ удалять — они становятся
веткой `PendingConfirmation` (§4.3). Плейсхолдер `{id}` — тем же механизмом, что
`tourDetail.moreIn` (`t(key, { id })`).

### 3.6 `shared/lib/returnTo.ts` — СОЗДАТЬ, `features/auth/lib/returnTo.ts` — УДАЛИТЬ

Перенести файл как есть (`safeReturnTo`, `readReturnTo`, `withReturnTo`, `FALLBACK`), не меняя
логику. Причина переезда — в шапке: `features/tours` теперь тоже строит `?returnTo=`, а фичи не
имеют права импортировать друг друга.

Обновить импорты в: `features/auth/AuthPage.tsx`, `features/auth/ChangePasswordPage.tsx`,
`features/auth/ForgotPasswordPage.tsx`, `features/auth/account/AccountPage.tsx` →
`from '@/shared/lib/returnTo'`.

### 3.7 `shared/auth/permissions.ts` + `index.ts` — ИЗМЕНИТЬ

```ts
/** «Календарь» (`api/Availability/*`, `Order/GetAll`) — Admin only, как и «Пользователи». */
export const canManageCalendar = isAdmin
```
Добавить в реэкспорт `shared/auth/index.ts` (алфавитный порядок сохранить).

---

## 4. Публичная часть — бронирование

### 4.1 `features/tours/lib/bookingWindow.ts` — СОЗДАТЬ

Окно брони перестаёт быть константой внутри `BookingCard`: его границы теперь нужны и лоадеру
(запрос закрытых дат), и карточке (`max` у `DatePicker`).

```ts
/** Правило Давида: бронировать можно с сегодня по «сегодня + 3 календарных месяца»
 *  (день месяца клампится `addMonths`). Ограничение чисто фронтовое — бэкенд его не проверяет
 *  (spec 001 §8), он отбивает только прошлое и закрытые дни. */
export const BOOKING_WINDOW_MONTHS = 3

export interface BookingWindow {
  /** `YYYY-MM-DD`, включительно. */
  fromISO: string
  /** `YYYY-MM-DD`, включительно. */
  toISO: string
}

/** Снимок окна на «сейчас». Вызывать один раз на загрузку экрана (лоадер) и мемоизировать в
 *  компоненте — то же допущение про «вкладка не живёт через полночь», что уже сделано в
 *  `DatePicker` (`today`). */
export function getBookingWindow(now: Date = new Date()): BookingWindow
```
Реализация — через `stripTime`/`addMonths`/`formatISODate` из `@/shared/lib/date`.

### 4.2 `features/tours/TourDetailPage.tsx` — ИЗМЕНИТЬ

В `tourDetailLoader` добавить третий параллельный запрос в существующий `Promise.all`:

```ts
const window = getBookingWindow()
const [related, content, closedDates] = await Promise.all([
  /* как есть */,
  /* как есть */,
  getClosedDates(Number(tour.id), window.fromISO, window.toISO).catch(() => [] as string[]),
])
return { tour, related: …, content, closedDates }
```

- `.catch(() => [])` обязателен и должен быть прокомментирован: доступность НЕ имеет права
  ронять страницу тура — тот же контракт, что у `getContentText`. Если список не пришёл,
  пользователь может выбрать закрытый день, и его отобьёт сервер (§4.4, обработка кода 2014).
- `tour.id` в публичной модели — `string` (`shared/types/tour.ts`), бэкенду нужен `number`:
  конвертировать `Number(tour.id)` в одном месте — здесь.
- Передать в карточку: `<BookingCard tour={tour} largeGroupInvitation={…} closedDates={closedDates} />`.
- Тип `useLoaderData` в компоненте расширить полем `closedDates: readonly string[]`.

### 4.3 `features/tours/components/BookingCard.tsx` — ИЗМЕНИТЬ

Props:
```ts
{
  tour: Tour
  largeGroupInvitation: string
  /** Закрытые для этого тура даты в пределах окна брони (`YYYY-MM-DD`), уже с учётом
   *  глобальных правил — сервер их сводит (ADR 012). Пустой массив = «нет данных или ничего
   *  не закрыто»; сервер всё равно проверяет дату при создании заказа. */
  closedDates: readonly string[]
}
```

Состояние компонента:
```ts
const [guests, setGuests] = useState(() => initialGuestsFromQuery())   // 1..16, дефолт 2
const [date, setDate] = useState(() => initialDateFromQuery())          // '' по умолчанию
const [dateMissing, setDateMissing] = useState(false)
const [pending, setPending] = useState(false)
const [error, setError] = useState<string | null>(null)   // готовая строка для показа
const [authNotice, setAuthNotice] = useState(false)       // показать блок «нужен вход»
const [order, setOrder] = useState<OrderInfoModel | null>(null)   // успех
/** Даты, которые сервер отбил как закрытые уже после загрузки страницы. */
const [serverClosed, setServerClosed] = useState<readonly string[]>([])
```

Производные значения:
```ts
const window = useMemo(() => getBookingWindow(), [])
const disabledDates = useMemo(
  () => new Set([...closedDates, ...serverClosed]),
  [closedDates, serverClosed],
)                                   // стабильная ссылка — требование DatePicker
const { status, user } = useAuth()  // из '@/shared/auth'
const isAuthKnown = status === 'authenticated' || status === 'anonymous'
```

Поведение:

1. **Восстановление выбора после логина.** На первом рендере (ленивая инициализация `useState`,
   не `useEffect`) прочитать `date` и `guests` из `window.location.search` через
   `new URLSearchParams`. Значения принимать только если: `date` матчит `parseISODate` и попадает
   в `[window.fromISO, window.toISO]` и не в `disabledDates`; `guests` — целое `1..16`. Иначе
   игнорировать. Читать `location.search` напрямую (не `useSearchParams`), чтобы не подписываться
   на изменения — восстановление одноразовое.
2. **`DatePicker`** получает `max={window.toISO}`, `disabledDates={disabledDates}` (проп `min` не
   передаём — `disablePast` уже покрывает нижнюю границу, как и сейчас).
3. **Сабмит** (`onSubmit`, `e.preventDefault()`):
   - если `date === ''` → `setDateMissing(true)`, выход (как сейчас);
   - если `!isAuthKnown` → выход без действий (кнопка в этот момент `disabled`, см. п.5);
   - если `status === 'anonymous'` → `setAuthNotice(true)`, выход. **Никакого редиректа
     автоматом** — уводить со страницы, ничего не спросив, значит потерять контекст;
   - иначе: `setPending(true)`, `setError(null)`,
     `createOrder({ tourId: Number(tour.id), tourDate: date, guestCount: guests })`;
     успех → `setOrder(created)`; ошибка → маппинг ниже; `finally` → `setPending(false)`.
4. **Маппинг ошибок** (локальная функция `bookingErrorMessage(err, t): string`, коды —
   локальные константы в этом же файле, как это делает `userCopy.ts`):
   - `TOUR_DATE_UNAVAILABLE = 2014` → `t('booking.dateUnavailable')` **и** добавить текущую
     `date` в `serverClosed`, и сбросить `date` в `''`: дата гасится в пикере, повторное нажатие
     той же датой невозможно;
   - `ORDER_DATE_IN_PAST = 2016` → `t('booking.datePast')` + тот же сброс `date`;
   - `INVALID_GUEST_COUNT = 2015` → `t('booking.submitFailed')` (в UI недостижимо: счётчик
     ограничен 1..16);
   - `SessionExpiredError` (из `@/shared/auth`) → `t('booking.sessionExpired')` +
     `setAuthNotice(true)`;
   - `ApiError` со `status === 401` → то же, что `SessionExpiredError`;
   - всё остальное → `t('booking.submitFailed')`.
   Читать код так же, как `userCopy.ts`: `errorCodeOf(err.body)` (`errorCode ?? ErrorCode`).
5. **Кнопка сабмита**: `disabled={pending || !isAuthKnown}`; текст — `t('booking.submitting')`
   при `pending`, иначе существующая логика (`price.hidden ? submitLargeGroup : submit`).
   `!isAuthKnown` — только на время холодного бутстрапа сессии; блокировать анонимного
   пользователя нельзя (он должен дойти до подсказки про вход).
6. **Блок «нужен вход»** (рендерится под кнопкой, когда `authNotice === true`), `role="status"`:
   заголовок `t('booking.authTitle')`, текст `t('booking.authBody')`, ссылка-кнопка
   `t('booking.authAction')` на
   ```ts
   withReturnTo('/auth', `${location.pathname}?date=${date}&guests=${guests}`)
   ```
   (`withReturnTo` из `@/shared/lib/returnTo`; `date` может быть пустым — тогда параметр не
   добавлять). Ссылка — `<Link>` из `react-router`, стилизована как вторичное действие карточки
   (не второй золотой CTA).
7. **Экран успеха** (`order !== null`) — тот же визуальный блок, что сейчас, но:
   - `order.status === OrderStatus.Confirmed` → `t('booking.submittedTitleConfirmed')` +
     `t('booking.submittedBodyConfirmed')`;
   - иначе (`PendingConfirmation`) → существующие `booking.submittedTitle`/`submittedBody`;
   - под заголовком строка `t('booking.orderNumber', { id: order.id })`;
   - кнопка «Изменить заявку» → `setOrder(null)` (форма возвращается с сохранёнными `date`/
     `guests`).
   **Не показывать никакие суммы из `order.payment`.** Сервер считает
   `TourPriceSnapshot * GuestCount` и не знает про фронтовую tiered-наценку 5–6 гостей
   (`shared/currency/pricing.ts`), поэтому его число может не совпасть с показанным «Итого».
   Показываем только номер и статус; деньги на этом экране — зона менеджера. Отметить это
   комментарием в коде.
8. **Ветка 7+ гостей** (`price.hidden`) отправляет такой же реальный заказ — «заявка без оплаты»
   ровно то же действие; ничего в поведении сабмита не разветвлять, меняется только копия
   (как сейчас).
9. Существующие комментарии-обоснования в файле (tiered pricing, почему `div`+`htmlFor`, почему
   guard на пустую дату живёт в компоненте) — сохранить; шапку файла переписать: блок больше не
   «UI only», описать реальный поток и требование авторизации.

### 4.4 Состояния и edge-кейсы публичной карточки

| Ситуация | Поведение |
| --- | --- |
| Сессия ещё грузится (`status: 'idle' \| 'loading'`) | Кнопка `disabled`, текст обычный; никаких «войдите» — это ещё не «аноним» |
| Аноним нажал «Забронировать» без даты | Сначала ошибка даты, блок «нужен вход» не показывать (одна проблема за раз) |
| Аноним вошёл и вернулся | Дата/гости восстановлены из query; если дата за это время закрылась — она в `disabledDates` не окажется (список загружен лоадером после логина заново) и сервер отобьёт код 2014 → сообщение + гашение |
| `getClosedDates` упал | `closedDates: []`, карточка работает; закрытую дату отобьёт сервер |
| Повторный сабмит по той же дате | Блокируется `pending`; двойных заказов не создаём |
| Токен протух между открытием страницы и сабмитом | `authFetch` сам обновит; если не вышло — `SessionExpiredError` → сообщение + блок входа |
| Тур архивирован/скрыт, пока страница открыта | Сервер вернёт `TourNotFound` → общий `booking.submitFailed` |

### 4.5 Мобильная адаптивность карточки (обязательно)

- Карточка на `<lg` уже идёт в одну колонку под контентом — не менять.
- Новый блок «нужен вход» и текст ошибки: `text-sm`, перенос по словам, без фиксированных
  ширин; кнопка-ссылка — `w-full` на `<sm`, `min-h-11`.
- Кнопка сабмита в состоянии `pending` не должна менять высоту карточки (текст «Отправляем…»
  той же строкой, без спиннера-иконки, меняющей высоту).
- `DatePicker` на узком экране открывается `Sheet`-ом (уже так) — проверить, что погашенные
  даты со `line-through` читаются в мобильном листе, а не только в поповере.
- Проверка обязательна на 360–390px: карточка, лист выбора даты, блок «нужен вход», экран
  успеха.

---

## 5. Админ-календарь

### 5.1 `features/admin/api/adminAvailability.ts` — СОЗДАТЬ

Шапка в стиле `adminUsers.ts`: база `api/Availability`, весь контроллер `Admin`-only, зеркалится
предикатом `canManageCalendar`.

```ts
/** Сетка месяца: по каждому дню — число заказов по турам и статус закрытия. `month` — 1..12. */
export function getCalendarMonth(year: number, month: number): Promise<CalendarMonthModel>
//  authFetch(`api/Availability/GetCalendar?year=${year}&month=${month}`)

/** Все правила закрытия. Без `tourId` — весь список (глобальные + все туровые). */
export function getClosureRules(tourId?: number): Promise<ClosureRuleInfoModel[]>
//  authFetch(`api/Availability/GetRules${tourId != null ? `?tourId=${tourId}` : ''}`)

/** Bulk-создание. Один POST на всю операцию — сервер принимает список (spec 001 §5.2). */
export function createClosureRules(models: ClosureRuleCreateModel[]): Promise<ClosureRuleInfoModel[]>
//  authFetch('api/Availability/CreateRules', { method: 'POST', body: JSON.stringify(models) })

export function deleteClosureRule(id: number): Promise<void>
//  authFetch(`api/Availability/DeleteRule?id=${id}`, { method: 'DELETE' })
```

### 5.2 `features/admin/api/adminOrders.ts` — СОЗДАТЬ

```ts
export interface OrderListFilters {
  tourId?: number
  /** `YYYY-MM-DD`, включительно. */
  from?: string
  to?: string
  status?: OrderStatus
}

/** Админский список заказов. Все фильтры опциональны; заголовок тура приходит на русском. */
export function getOrders(filters?: OrderListFilters): Promise<OrderInfoModel[]>
//  authFetch(`api/Order/GetAll${qs}`) — сборка query через URLSearchParams, пустые поля не слать
```
Отмена заказа сознательно не добавляется — см. §8.

### 5.3 `features/admin/calendar/lib/calendarModel.ts` — СОЗДАТЬ

Чистые функции подготовки данных к рендеру (никакого JSX, никакой сети).

```ts
/** Ключ кэша/поиска: `YYYY-MM`. */
export function monthKey(year: number, month: number): string

/** Одна клетка сетки. */
export interface CalendarGridDay {
  date: Date
  iso: string
  /** Принадлежит отображаемому месяцу (иначе — «хвост» соседнего, приглушённый). */
  inMonth: boolean
  isToday: boolean
  isPast: boolean
  /** Данные сервера по этому дню; `null` для дней-хвостов вне загруженного месяца. */
  day: CalendarDayModel | null
}

/** 42 клетки Monday-first (через `getMonthGrid` из `shared/lib/date`), склеенные с ответом
 *  сервера по `iso`. `month` — 1..12. */
export function buildCalendarGrid(
  year: number, month: number, data: CalendarMonthModel | null, today?: Date,
): CalendarGridDay[]

/** Уровень закрытия дня — для индикатора в клетке. */
export type DayClosureLevel = 'open' | 'partial' | 'closed'
export function closureLevelOf(day: CalendarDayModel | null): DayClosureLevel
//  null → 'open'; isClosedGlobally → 'closed'; closedTourIds.length > 0 → 'partial'; иначе 'open'

/** Заголовок туру по id — для клеток/списков. Неизвестный id → `Тур #${id}` (тур мог быть
 *  заархивирован, а заказы на него остались). */
export function tourTitleResolver(tours: TourInfoModel[]): (tourId: number) => string
//  внутри — Map по id, title берётся из translations (TourTranslationType.Title, RU)
```
Заголовок вытаскивается из `TourInfoModel.translations` фильтром
`t.type === TourTranslationType.Title && t.languageCode === LanguageCode.Russian`
(оба enum — из `@/features/admin/lib/enums`). Ровно такой фильтр уже написан в приватной
`titleHaystack` внутри `features/admin/products/lib/filterProducts.ts` — но она приватная и
склеивает RU+EN в одну строку для поиска, поэтому переиспользовать её нельзя: повторить нужно
только сам способ выборки, не копируя функцию.

### 5.4 `features/admin/calendar/lib/closureResolver.ts` — СОЗДАТЬ (ADR 015)

```ts
/**
 * Клиентская копия серверного `ClosureRuleResolver.IsClosed` (ADR 012 / ADR 015).
 * МЕНЯТЬ ТОЛЬКО ВМЕСТЕ с `Backend/.../Services/Availability/ClosureRuleResolver.cs`.
 * Используется ИСКЛЮЧИТЕЛЬНО для планирования мутаций (`closureToggle.ts`) и предпросмотра
 * массовой операции. Отображение состояния берётся из ответа сервера, не отсюда.
 */
export function resolveClosure(
  rules: readonly ClosureRuleInfoModel[],
  dateISO: string,
  tourId: number | null,
): boolean
```
Алгоритм (буквально по spec 001 §4.2):
1. Отобрать применимые: область — `rule.tourId === null` (глобальное) либо
   `rule.tourId === tourId`; для `SpecificDate` — `rule.date === dateISO`; для `Weekly` —
   `rule.dayOfWeek === dayOfWeekCodeOf(dateISO)` и `dateISO` внутри
   `[effectiveFrom, effectiveTo]` (границы включительно, `null` = без границы).
2. Приоритет по убыванию специфичности: `Tour+SpecificDate` > `Global+SpecificDate` >
   `Tour+Weekly` > `Global+Weekly`. Внутри одного уровня — правило с бо́льшим `id` (последнее
   созданное) побеждает.
3. Победитель `Open` → `false`, `Close` → `true`. Нет применимых → `false`.

Экспортировать вспомогательное `export function dayOfWeekCodeOf(dateISO: string): DayOfWeekCode`
(через `parseISODate(...).getDay()` — совпадает с `System.DayOfWeek`).

### 5.5 `features/admin/calendar/lib/closureToggle.ts` — СОЗДАТЬ

```ts
/** План минимальной мутации: что удалить и что создать, чтобы день пришёл в нужное состояние. */
export interface ClosurePlan {
  deleteIds: number[]
  create: ClosureRuleCreateModel[]
}

/**
 * @param rules   ВСЕ известные правила (из лоадера).
 * @param dateISO день, который переключаем.
 * @param tourId  `null` = глобально (весь день), иначе конкретный тур.
 * @param close   `true` — сделать день закрытым, `false` — открытым.
 */
export function planDayToggle(
  rules: readonly ClosureRuleInfoModel[], dateISO: string, tourId: number | null, close: boolean,
): ClosurePlan
```
Алгоритм:
1. `sameScopeSpecific` = правила с `type === SpecificDate && date === dateISO` и той же областью
   (`tourId === null` для глобального переключателя; `tourId === X` для туровского — глобальные
   правила при туровском переключении НЕ трогаем).
2. `deleteIds = sameScopeSpecific.map(r => r.id)`.
3. `baseline = resolveClosure(rules без sameScopeSpecific, dateISO, tourId)` — каким день станет
   после удаления (то есть что диктуют weekly-правила и, для тура, глобальные).
4. Если `baseline === close` → `create: []` (достаточно удаления).
   Иначе `create: [{ tourId, type: SpecificDate, action: close ? Close : Open, date: dateISO,
   reason: null }]`.
5. Если `deleteIds.length === 0 && create.length === 0` → план пустой; вызывающий не шлёт
   запросов и ничего не инвалидирует.

Порядок применения в `CalendarPage`: сначала все `DeleteRule` (последовательно, `for…of` —
эндпоинт точечный), затем один `CreateRules` со списком. При ошибке на любом шаге — стоп,
показать баннер, инвалидировать кэш и перечитать (состояние могло частично примениться).

### 5.6 `features/admin/calendar/lib/closureRuleForm.ts` — СОЗДАТЬ

Состояние формы массовой операции и её компиляция в список моделей.

```ts
export type BulkMode = 'range' | 'weekly'

export interface BulkClosureForm {
  action: ClosureAction
  mode: BulkMode
  /** `YYYY-MM-DD`; для `range` — границы диапазона, для `weekly` — необязательный период. */
  fromISO: string
  toISO: string
  /** Только для `weekly`; хотя бы один день. */
  weekdays: DayOfWeekCode[]
  /** Пусто = «Все туры» (`tourId: null`, ОДНО глобальное правило). */
  tourIds: number[]
  reason: string
}

export const emptyBulkForm: BulkClosureForm

/** Максимум правил за одну операцию. Диапазон × туры взрывается быстро (92 дня × 10 туров =
 *  920 правил), а список правил потом читать людям. Больше — предлагаем сузить или перейти на
 *  weekly. */
export const MAX_BULK_RULES = 300

export type BulkValidation =
  | { ok: true; models: ClosureRuleCreateModel[] }
  | { ok: false; message: string }

/** Валидация + компиляция. Никакой сети, никакого стейта. */
export function compileBulkForm(form: BulkClosureForm): BulkValidation
```
Правила компиляции:
- `mode === 'range'`: обязательны `fromISO` и `toISO`, `from <= to`; итог — декартово произведение
  `eachDayInRange(from, to)` × (`tourIds` или `[null]`), каждое →
  `{ type: SpecificDate, action, date, tourId, reason }`.
- `mode === 'weekly'`: обязателен непустой `weekdays`; `fromISO`/`toISO` необязательны (пустая
  строка → `null`), но если заданы обе — `from <= to`; итог — `weekdays` × (`tourIds` или
  `[null]`), каждое → `{ type: Weekly, action, dayOfWeek, effectiveFrom, effectiveTo, tourId,
  reason }`.
- `reason` тримится, пустой → `null`, длина > 500 → ошибка (лимит колонки).
- Итоговый размер > `MAX_BULK_RULES` → `{ ok: false, message }` с числом и подсказкой.
- Сообщения об ошибках — из `calendarCopy.ts`, не литералами здесь.

### 5.7 `features/admin/calendar/lib/calendarCopy.ts` — СОЗДАТЬ

Вся русская копия экрана + маппинг ошибок, ровно по образцу `users/lib/userCopy.ts`:
```ts
export const calendarCopy = { … }          // заголовки, подписи, тексты пустых состояний,
                                           // подписи легенды, тексты подтверждений
export const weekdayLabels: Record<DayOfWeekCode, string>        // «Пн»…«Вс»
export const weekdayLabelsFull: Record<DayOfWeekCode, string>    // «понедельник»…
export const monthLabels: string[]                               // «Январь»…«Декабрь» (им.п.)
export function calendarErrorMessage(err: unknown, action: string): string
```
Коды из spec 001 §7, которые реально может вернуть этот экран (объявить локальными константами
с комментарием, как в `userCopy.ts`):
`INVALID_CLOSURE_RULE = 2017` → «Правило заполнено неверно — проверьте даты и день недели.»;
`TOUR_NOT_FOUND = 2004` → «Тур не найден — обновите страницу.»;
`RELATIONAL_ENTITY_NOT_FOUND = 2003` (удаление уже удалённого правила) → «Правило уже удалено —
обновите страницу.»; `403` → «Недостаточно прав.»; прочее → `Не удалось ${action}: сервер вернул
ошибку (${status}).`; не-`ApiError` → «…проверьте соединение».

### 5.8 `features/admin/calendar/hooks/useCalendarMonth.ts` — СОЗДАТЬ (ADR 016)

```ts
export interface MonthBundle {
  calendar: CalendarMonthModel
  /** Все заказы месяца (кроме отменённых — фильтруются здесь, чтобы панель дня совпадала со
   *  счётчиками сетки, которые сервер уже считает без Cancelled). */
  orders: OrderInfoModel[]
}

export interface UseCalendarMonthResult {
  data: MonthBundle | null
  isLoading: boolean
  error: unknown
  /** Сбрасывает весь кэш и перезагружает текущий месяц. Звать после любой мутации правил. */
  invalidateAll: () => void
  /** Повтор после ошибки. */
  retry: () => void
}

export function useCalendarMonth(year: number, month: number): UseCalendarMonthResult
```
Требования к реализации:
- Кэш — `useRef<Map<string, MonthBundle>>`, ключ `monthKey(year, month)`. Живёт, пока смонтирован
  экран (кэш между визитами не нужен).
- Загрузка: `Promise.all([getCalendarMonth(y, m), getOrders({ from, to })])`, границы месяца —
  `startOfMonth`/`endOfMonth` + `formatISODate`.
- Дедупликация: параллельные запросы одного ключа не дублируются (`Map<string, Promise>`
  в ref), гонка «пользователь листает быстрее сети» разрешается по последнему запрошенному
  ключу — ответ на устаревший ключ кладётся в кэш, но не переключает `data`.
- Отмена: `AbortController` на каждый запрос, abort в cleanup эффекта; `signal` пробрасывается
  в `authFetch` через `init`.
- Префетч: после успешной загрузки месяца — фоновая загрузка `месяц + 1` (без `isLoading`,
  ошибки глотать). Запускать через `requestIdleCallback`, если он есть, иначе `setTimeout(0)`.
- `isLoading` — только когда для текущего ключа нет данных в кэше; при листании на уже
  загруженный месяц перерисовка мгновенная, без «мигания» скелета.
- Шапка файла обязана объяснить отход от лоадерного паттерна со ссылкой на ADR 016.

### 5.9 `features/admin/calendar/CalendarPage.tsx` — СОЗДАТЬ

**Loader** (экспортируется как `calendarLoader`):
```ts
export async function calendarLoader() {
  await ensureAuthReady()
  if (!canManageCalendar(getAuthState().user?.role)) throw redirect('/admin')
  const [tours, rules] = await Promise.all([getAllTours(), getClosureRules()])
  return { tours, rules }
}
```
Ошибки не глотать (летят в `AdminErrorBoundary`) — контракт `catalogLoader`.

**Контейнер.** Здесь и только здесь живут: выбранный месяц, выбранный день, открытые панели,
`pending`/`error` мутаций и ВСЕ сетевые мутации (образец — `UsersPage.handleChangeRole`).
Дочерние компоненты сеть не трогают.

```ts
const { tours, rules } = useLoaderData<typeof calendarLoader>()
const revalidator = useRevalidator()
const [view, setView] = useState(() => ({ year: nowYear, month: nowMonth }))   // month 1..12
const [selectedISO, setSelectedISO] = useState<string | null>(null)
const [bulkOpen, setBulkOpen] = useState(false)
const [tab, setTab] = useState<'calendar' | 'rules'>('calendar')
const [pending, setPending] = useState(false)
const [error, setError] = useState<string | null>(null)
const { data, isLoading, error: loadError, invalidateAll, retry } = useCalendarMonth(view.year, view.month)
```

Мутации (все по одной схеме: `setPending(true)` → запрос → `invalidateAll()` +
`revalidator.revalidate()` → `setPending(false)`, ошибка → `setError(calendarErrorMessage(...))`):
- `applyDayToggle(dateISO, tourId, close)` — строит план `planDayToggle(rules, …)`, если план
  пустой — ничего не делает; иначе последовательные `deleteClosureRule` + один
  `createClosureRules`.
- `applyBulk(models)` — один `createClosureRules(models)`, закрыть панель на успехе.
- `deleteRule(id)` — `deleteClosureRule`, через `Modal`-подтверждение (правило может закрывать
  много дней — это не мелкое действие).

Границы навигации по месяцам: `MONTH_RANGE_BACK = 12`, `MONTH_RANGE_FORWARD = 12` (относительно
текущего месяца). Кнопки на границе — `disabled`, не скрыты. Кнопка «Сегодня» возвращает к
текущему месяцу и всегда активна.

**Разметка** (порядок сверху вниз):
1. `header` — h1 «Календарь» + подзаголовок («Занятость по дням и правила закрытия дат.»).
2. Баннер ошибки мутации (`role="alert"`, стиль 1:1 из `UsersPage`).
3. `Tabs` — «Календарь» / «Правила», sticky как в `CatalogPage` (`sticky top-[60px] … md:top-0`).
4. Вкладка «Календарь»: `CalendarToolbar` → `CalendarMonthGrid` → легенда.
5. Вкладка «Правила»: `ClosureRulesTable`.
6. `DayDetailPanel` (открыт при `selectedISO !== null`).
7. `BulkClosurePanel` (открыт при `bulkOpen`).

### 5.10 `components/CalendarToolbar.tsx` — СОЗДАТЬ (презентационный)

Props: `{ year, month, canGoBack, canGoForward, isLoading, onPrev, onNext, onToday, onOpenBulk }`.
- Строка 1: `←` `Август 2026` `→` (кнопки 44×44, `aria-label` «Предыдущий месяц»/«Следующий»),
  справа кнопка «Сегодня» (вторичная) и «Массовые операции» (основная).
- Заголовок месяца — `aria-live="polite"`, чтобы смена месяца озвучивалась.
- Индикатор загрузки — тонкая полоса/`Spinner` рядом с заголовком, БЕЗ подмены содержимого:
  сетка не должна исчезать при листании на незагруженный месяц (показывать скелет только когда
  данных нет вообще).
- **Мобильно**: `flex-col gap-2` до `sm`; строка навигации месяцем — отдельная строка,
  «Массовые операции» — `w-full` кнопка ниже. Никакого горизонтального скролла.

### 5.11 `components/CalendarMonthGrid.tsx` + `CalendarDayCell.tsx` — СОЗДАТЬ (презентационные)

`CalendarMonthGrid` props:
```ts
{
  days: CalendarGridDay[]                 // 42 клетки из buildCalendarGrid
  selectedISO: string | null
  tourTitle: (tourId: number) => string
  onSelectDay: (iso: string) => void
  isSkeleton: boolean                     // данных ещё нет — рисуем пустую сетку-заглушку
}
```
- Заголовок недель: `grid-cols-7`, «Пн…Вс», `aria-hidden` (как в `DatePicker`).
- Сетка: `grid grid-cols-7 gap-1`, каждая клетка — `<button type="button">` во всю ширину
  колонки, `aspect-square min-h-11`, `min-w-0`.
- `role`: сетка — обычный `div` с кнопками (не `role="grid"`): роверинг здесь не нужен, каждая
  клетка обычная кнопка в естественном таб-порядке. Это осознанно проще, чем APG-паттерн
  `DatePicker`.

`CalendarDayCell` props: `{ day: CalendarGridDay, selected: boolean, tourTitle, onSelect }`.
Содержимое клетки:
- число месяца (верхний левый угол, `text-xs sm:text-sm`; сегодня — жирный `text-brand-700`,
  день не из месяца — `opacity-40`);
- индикатор закрытия: `closed` → диагональная штриховка фона + значок замка/«×» и
  `bg-neutral-100 text-neutral-400`; `partial` → маленькая точка-индикатор янтарного цвета
  в верхнем правом углу; `open` → ничего;
- счётчик заказов: если `day.totalOrders > 0` — пилюля с числом внизу клетки
  (`bg-brand-50 text-brand-700`), на `sm+` дополнительно суммарные гости мелким шрифтом,
  на мобильном — только число;
- `aria-label` полностью описывает клетку словами: `«12 августа, 3 заказа, 7 гостей, закрыто»`
  — визуальные индикаторы дублируются текстом;
- `title` (десктоп) — то же, что `aria-label`;
- выбранный день — кольцо `ring-2 ring-brand-600`.

**Мобильно (жёстко)**: при ширине 360px клетка ≈ 45px. Поэтому внутри клетки максимум два
элемента (число + пилюля/точка), `text-[10px]` для пилюли, `truncate`/`tabular-nums`, никаких
названий туров внутри клетки. Сетка обязана помещаться без горизонтального скролла — проверить
на 360px и 390px.

### 5.12 `components/DayDetailPanel.tsx` — СОЗДАТЬ

Обёртка — `SidePanel` (`features/admin/ui/SidePanel.tsx`), `title` = дата прописью
(«12 августа 2026, среда»).

Props:
```ts
{
  open: boolean
  dateISO: string | null
  day: CalendarDayModel | null           // из загруженного месяца
  orders: OrderInfoModel[]               // уже отфильтрованные по этому дню (из MonthBundle)
  tours: TourInfoModel[]
  rules: ClosureRuleInfoModel[]
  pending: boolean
  onClose: () => void
  onToggleClosure: (tourId: number | null, close: boolean) => void
}
```
Секции внутри (сверху вниз):
1. **Доступность** — `DayClosureControls` (§5.13).
2. **Заказы** — `DayOrdersList` (§5.14).
Разделитель между секциями — `border-t border-neutral-200`.

Панель не делает запросов: заказы уже в кэше месяца (ADR 016). Если `day === null` (день из
хвоста соседнего месяца) — секция заказов показывает «Нет данных за этот день», управление
закрытием остаётся доступным (правило можно создать на любую дату).

### 5.13 `components/DayClosureControls.tsx` — СОЗДАТЬ

Props: `{ dateISO, day, tours, rules, pending, onToggle(tourId, close) }`.

Содержимое:
1. Переключатель «Закрыть весь день (все туры)» — `Checkbox` (или кнопка-тумблер), значение =
   `day?.isClosedGlobally === true`, `disabled={pending}`; `onChange` → `onToggle(null, next)`.
   Под ним — пояснение, откуда взялось текущее состояние: если день закрыт, но среди правил нет
   `SpecificDate` на эту дату (проверяется по `rules`), показать «закрыт правилом по дню недели»
   — админ должен понимать, что снятие галочки создаст исключение, а не удалит правило.
2. **Закрытые туры этого дня**: строки по `day.closedTourIds` (название через `tourTitle`) с
   кнопкой «Открыть» → `onToggle(tourId, false)`. Если список пуст — строка не рисуется.
3. **Закрыть отдельный тур**: `Select` (`surface="admin"`, `searchable` для длинного списка — проп называется именно так) со
   списком туров, исключая уже закрытые, + кнопка «Закрыть» → `onToggle(tourId, true)`.
   После успеха выбор сбрасывается (контролируется родителем через ключ/эффект на `day`).
4. Когда день закрыт глобально, блок 3 отключён (`disabled`) с подсказкой «День уже закрыт
   целиком» — туровое правило поверх глобального не имеет смысла и только замусорит список.

### 5.14 `components/DayOrdersList.tsx` — СОЗДАТЬ (чисто презентационный)

Props: `{ orders: OrderInfoModel[], tourTitle: (id: number) => string }`.
- Группировка по `tourId`: заголовок группы — название тура + «N заказов · M гостей».
- Строка заказа: `userFullName` (или `userEmail`, если ФИО пустое), число гостей,
  `Заказ №{id}`, статус-чип (`Подтверждён` / `Ждёт подтверждения`), время создания
  (`new Date(order.createdAtUtc).toLocaleString('ru-RU')` — бэкенд отдаёт корректный UTC, см.
  правку Kind=Utc от 2026-08-11), `userEmail` как `mailto:`-ссылка.
- Пусто → «Заказов на этот день нет.» (стиль пустого состояния — как в `UsersPage`:
  `rounded-xl border border-dashed …`).
- Суммы (`payment`) НЕ показывать — та же причина, что в §4.3 п.7 (расхождение с фронтовой
  tiered-ценой). Разъяснить комментарием.
- **Мобильно**: строка заказа — колонка (`flex-col`) до `sm`, длинные email — `break-all`.

### 5.15 `components/BulkClosurePanel.tsx` — СОЗДАТЬ

Обёртка — `SidePanel`, `title` «Массовые операции».
Props: `{ open, tours, pending, onClose, onApply(models: ClosureRuleCreateModel[]): void }`.
Внутреннее состояние — `BulkClosureForm` (§5.6); при закрытии сбрасывается в `emptyBulkForm`.

Поля (сверху вниз, все — во всю ширину панели):
1. **Действие**: два радио — «Закрыть даты» / «Открыть даты (исключение)». Под «Открыть» —
   пояснение: «нужно, чтобы открыть отдельные дни внутри повторяющегося закрытия».
2. **Тип**: два радио — «Диапазон дат» / «Повтор по дням недели».
3. `mode === 'range'`: два `DatePicker` (`surface="admin"`, `disablePast={false}`) — «С» и «По».
   `mode === 'weekly'`: сетка чекбоксов Пн–Вс (`grid grid-cols-4 sm:grid-cols-7 gap-2`) +
   необязательный период «действует с / по» теми же `DatePicker`.
4. **Область**: радио «Все туры» / «Выбранные туры». При «Выбранные» — чипы-пресеты
   «Все · Туры · Экскурсии» (заполняют мультивыбор по `TourType`) и список туров чекбоксами
   с полем поиска по названию (обычный `Input` + фильтрация `includes` без учёта регистра).
5. **Причина** (`Textarea`, до 500 символов, необязательно) + счётчик символов.
6. **Предпросмотр**: строка «Будет создано N правил» (пересчёт на каждое изменение через
   `useMemo` + `compileBulkForm`), и, если `compileBulkForm` вернул ошибку — текст ошибки
   `role="alert"` вместо числа.
7. Кнопки: «Применить» (`disabled` при `pending` или невалидной форме) и «Отмена».
   Перед применением при `N > 50` — `Modal`-подтверждение с числом правил.

**Мобильно**: панель уже во всю ширину; все контролы `w-full`, чекбоксы дней недели — 4 колонки,
кнопки внизу — `flex-col-reverse gap-2` до `sm` (основное действие сверху под пальцем).

### 5.16 `components/ClosureRulesTable.tsx` — СОЗДАТЬ

Props: `{ rules: ClosureRuleInfoModel[], tours: TourInfoModel[], pending, onDelete(id: number) }`.
- Сортировка: сначала глобальные, затем по названию тура; внутри — `SpecificDate` по дате,
  затем `Weekly` по дню недели.
- Колонки: Область (`Все туры` / название тура), Тип (`Дата` / `По дню недели`), Когда
  (`12.08.2026` либо `каждый понедельник`), Период (`с … по …` либо `—`), Действие
  (чип `Закрыто` / `Открыто`), Причина, кнопка удаления.
- Пусто → «Правил закрытия пока нет.» + подсказка про кнопку «Массовые операции».
- **Мобильно**: тот же приём, что у `users/components/UsersTable.tsx` — обёртка
  `overflow-x-auto rounded-xl border border-neutral-200 bg-white` + `table` с `min-w-[720px]`.
  Карточную раскладку под `sm` НЕ изобретаем: в проекте её нет ни на одном экране, и вводить
  второй способ показа таблицы ради одного списка — лишняя сущность. Горизонтальный скролл
  допустим ТОЛЬКО внутри этой таблицы; сетка месяца (§5.11) обязана помещаться по ширине.

### 5.17 `features/admin/index.ts` — ИЗМЕНИТЬ

```ts
export { CalendarPage, calendarLoader } from './calendar/CalendarPage'
```
(добавить после `ProductsPage`, порядок как в сайдбаре).

### 5.18 `app/router.tsx` — ИЗМЕНИТЬ

В детях роута `admin`, сразу после `products`:
```tsx
{
  path: 'calendar',
  lazy: () =>
    import('@/features/admin').then((m) => ({ Component: m.CalendarPage, loader: m.calendarLoader })),
},
```
Отдельного чанка календарю не делаем: вся админка уже за одним ленивым импортом и за проверкой
роли — дробить дальше нечего (записать это комментарием не нужно, здесь фиксируем решение).

### 5.19 `features/admin/layout/AdminSidebar.tsx` — ИЗМЕНИТЬ

В `navItems` после «Продукты»:
```ts
{ to: '/admin/calendar', label: 'Календарь', icon: '📅', can: canManageCalendar },
```
`canManageCalendar` импортировать из `@/shared/auth` (файл уже импортирует предикаты оттуда).

---

## 6. Состояния и edge-кейсы админ-календаря

| Ситуация | Поведение |
| --- | --- |
| Месяц грузится впервые | Скелет сетки (42 серые клетки), тулбар активен |
| Листание на закэшированный месяц | Мгновенно, без скелета и без спиннера |
| Листание на незагруженный месяц | Сетка предыдущего месяца НЕ остаётся: показываем скелет; тулбар при этом уже показывает новый месяц |
| Запрос месяца упал | Вместо сетки — блок с текстом ошибки и кнопкой «Повторить» (`retry`); тулбар остаётся рабочим |
| Заказов в месяце нет | Сетка рисуется как обычно, без пилюль |
| Клик по дню-«хвосту» соседнего месяца | Панель открывается, секция заказов — «Нет данных за этот день»; управление закрытием доступно |
| Мутация в процессе | Все переключатели и кнопки применения `disabled`; панель не закрывается сама |
| Мутация упала | Баннер над вкладками, кэш инвалидируется и месяц перечитывается (состояние могло частично примениться) |
| Правило удалено кем-то параллельно | `RelationalEntityNotFound` → «Правило уже удалено — обновите страницу», `revalidate` |
| Тур заархивирован, но заказы на него есть | Название через `tourTitleResolver` → `Тур #ID`; экран не падает |
| Роль TourManager открыл `/admin/calendar` | `calendarLoader` делает `redirect('/admin')`, пункт меню ему и так не виден |
| Сессия истекла в фоне | `authFetch` → `SessionExpiredError` из лоадера → `AdminErrorBoundary` со ссылкой на `/auth?returnTo=` (существующее поведение) |

---

## 7. Мобильная адаптивность — обязательный чек-лист (правило проекта)

Проверяется реально, на узком экране, а не «по вёрстке». Ширины: **360, 390, 768, 1280**.

Админ-календарь:
1. Сетка месяца помещается без горизонтального скролла на 360px, клетки квадратные, тап-цель
   ≥ 44px по высоте.
2. Тулбар переносится в две строки; кнопка «Массовые операции» — на всю ширину.
3. Вкладки «Календарь/Правила» sticky под мобильной шапкой панели (`top-[60px]`), не
   перекрывают содержимое.
4. `SidePanel` (день и массовые операции) на мобильном — на всю ширину, содержимое скроллится
   внутри панели, фон не скроллится (`useBodyScrollLock` уже в компоненте).
5. Таблица правил на `<sm` — скроллится горизонтально ВНУТРИ своей рамки; страница целиком — нет.
6. `DatePicker` внутри `SidePanel` на мобильном открывается `Sheet`-ом поверх панели — проверить,
   что лист не оказывается ПОД панелью (обе используют портал и `z-50`; при конфликте поднять
   `Sheet` — правку делать в вызове, а не в общем компоненте, если она вообще потребуется).
7. Длинные названия туров — `truncate`, без разрыва сетки.

Публичная карточка бронирования:
8. Карточка, блок «нужен вход», сообщение об ошибке и экран успеха — на 360px без обрезаний.
9. Мобильный лист выбора даты: погашенные даты визуально отличимы (`line-through` + приглушение).
10. Клавиатура на мобильном не перекрывает кнопку «Забронировать» (в карточке нет текстовых
    полей, но проверить после возврата с `/auth`).

---

## 8. Явно ВНЕ скоупа

- **Отмена/подтверждение заказа из админки** (`Order/Cancel`, будущий confirm) — эндпоинт есть,
  UI не делаем; в `adminOrders.ts` функции отмены НЕ заводить (мёртвый код).
- **Экран «Мои заказы»** для клиента (`Order/GetMine`) — отдельная задача, `shared/api/booking.ts`
  функцию не получает.
- **Фильтры/поиск по заказам в админке** (по туру/статусу/периоду) — сейчас заказы видны только
  в контексте дня.
- **Редактирование существующего `ClosureRule`** — бэкенда нет (spec 001 §8): только создать/
  удалить.
- **Отображение денег заказа** где бы то ни было на фронте (см. §4.3 п.7 и §5.14).
- **Показ занятости/остатка мест на публичном сайте** — публично гасим только закрытые даты;
  количество заказов наружу не отдаётся и не показывается.
- **Перевод админки на i18n** — админка русская.
- **Перенос окна брони (3 месяца) на бэкенд** — остаётся фронтовым лимитом.
- **Дробление админ-бандла на дополнительные чанки** — вся админка уже за одним lazy-импортом.

---

## 9. Порядок реализации (чек-лист для `frontend-developer`)

1. `shared/lib/date.ts` — перенос календарных хелперов + `endOfMonth`/`eachDayInRange`;
   `DatePicker` переключить на импорт (поведение не меняется, проверить страницу тура).
2. `shared/types/booking.ts`.
3. `shared/api/booking.ts`.
4. `shared/lib/returnTo.ts` + удаление `features/auth/lib/returnTo.ts` + 4 импортёра.
5. `shared/auth/permissions.ts` / `index.ts` — `canManageCalendar`.
6. `shared/ui/DatePicker.tsx` — `disabledDates` + оформление недоступных дат.
7. `shared/i18n/dictionary.ts` — ключи из §3.5 (ru + en).
8. `features/tours/lib/bookingWindow.ts` → `TourDetailPage` (loader) → `BookingCard`.
   **Проверить публичную бронь целиком до перехода к админке.**
9. `features/admin/api/adminAvailability.ts`, `adminOrders.ts`.
10. `calendar/lib/*`: `calendarModel` → `closureResolver` → `closureToggle` → `closureRuleForm`
    → `calendarCopy` (чистые модули первыми — на них опирается всё остальное).
11. `calendar/hooks/useCalendarMonth.ts`.
12. `calendar/components/*`: `CalendarDayCell` → `CalendarMonthGrid` → `CalendarToolbar` →
    `DayOrdersList` → `DayClosureControls` → `DayDetailPanel` → `BulkClosurePanel` →
    `ClosureRulesTable`.
13. `calendar/CalendarPage.tsx` (страница + loader + мутации).
14. `features/admin/index.ts`, `app/router.tsx`, `AdminSidebar.tsx`.
15. Прогон по чек-листу §7 (мобильная адаптивность) на 360/390/768/1280.
16. Передача `tester` (в т.ч. юнит-покрытие `closureResolver`/`closureToggle`/`compileBulkForm`),
    затем `update-docs` (`admin-panel.md`, `client-site.md`, `CHANGELOG.md`).
