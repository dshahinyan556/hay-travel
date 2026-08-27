# Spec 008 — Корзина туров на публичном сайте

- Дата: 2026-08-22 (ред. 2 — чекаут переписан под один мультистрочный заказ)
- Архитектурное обоснование: [ADR 022](../adr/022-cart-as-client-side-accumulator.md) (клиентский
  накопитель) + [ADR 025](../adr/025-cart-checkout-single-multiline-order.md) (чекаут = один
  атомарный мультистрочный заказ)
- Бэкенд: **меняется**, отдельной задачей — [spec 013](013-cart-checkout-backend.md).
  `POST api/Order/Create` начинает принимать массив строк. Эта спецификация описывает **только**
  фронтовую сторону и опирается на контракт из spec 013 §3.

> **Изменение от 2026-08-22 (ред. 2).** Первая редакция описывала чекаут как N последовательных
> вызовов `createOrder()` по одной позиции с частичным успехом как штатным исходом. Отменено
> решением Давида: «всё, что in cart, в out становится одним order». Теперь — один запрос, один
> заказ, атомарно. Разделы §5.3, §6, §7, §8.1, §10, §11, §12 переписаны; §3, §4 (стор, схема
> позиции, `shared/booking`) не менялись.

## 0. Что делаем в одном абзаце

Кнопка на странице тура вместо мгновенного создания заказа кладёт позицию
(`tourId` + дата + число гостей) в клиентскую корзину в `localStorage`. Появляется страница
`/cart` со списком позиций (дата и гости редактируются прямо там), итогом и кнопкой «Отправить
заявку», которая **одним запросом** создаёт **один** заказ со всеми позициями в виде строк. Вход в
аккаунт требуется только в момент отправки. В шапке — иконка-ссылка на `/cart` с бейджем
количества.

---

## 1. Порядок работ

| # | Этап | Исполнитель | Блокирует |
| --- | --- | --- | --- |
| 1 | Стор + типы + переезд `shared/booking` (§3, §4) | `frontend-developer` | всё остальное |
| 2 | Дизайн экрана `/cart` и всех его состояний, иконка в шапке, подтверждение в `BookingCard` (§11) | `designer` | этап 4 |
| 3 | `GuestStepper` как shared-примитив, `BagIcon` (§8.3, §8.5) | `ui-ux-engineer` | этап 4 |
| 4 | `CartPage` + чекаут + правка `BookingCard` + шапка (§5, §6, §7, §8, §9) | `frontend-developer` | — |
| 5 | i18n-ключи (§10) | вместе с этапом 4 | — |

Этап 1 не требует ни дизайна, ни готового бэкенда и может стартовать сразу. Этап 4 требует
задеплоенного бэкенда из spec 013 (контракт запроса изменился несовместимо — старый одно-строчный
`POST Create` после spec 013 не существует).

---

## 2. Дерево файлов

### Создать

```
src/shared/cart/
  types.ts            — CartItem, CartState, входные/выходные типы стора
  cartStore.ts        — module-level observable + localStorage + storage-event
  useCart.ts          — useSyncExternalStore-биндинги
  index.ts            — бочка

src/shared/booking/
  bookingWindow.ts    — ПЕРЕЕЗД из features/tours/lib/bookingWindow.ts (без правок содержимого)
  tourDiscount.ts     — ПЕРЕЕЗД из features/tours/lib/tourDiscount.ts (без правок содержимого)
  useTierPrice.ts     — ПЕРЕЕЗД из features/tours/hooks/useTierPrice.ts (без правок содержимого)
  guests.ts           — НОВЫЙ: MIN_GUESTS/MAX_GUESTS/clampGuests
  index.ts            — бочка

src/features/cart/
  CartPage.tsx                      — cartLoader + контейнер страницы
  components/CartLineCard.tsx       — одна позиция (дата, гости, цена, ошибка, удалить)
  components/CartSummary.tsx        — итог + CTA + блок «нужен вход»
  components/CartEmptyState.tsx     — пустая корзина
  components/CheckoutResultPanel.tsx— успешный результат (один номер заказа)
  hooks/useCheckout.ts              — один вызов createOrder + разбор пер-строчных ошибок
  hooks/useCartTotal.ts             — сумма по корзине в AMD → одна форматированная строка
  lib/checkoutErrors.ts             — разбор OrderLinesErrorModel + маппинг кодов в копию
  index.ts                          — бочка

src/app/layout/CartNavButton.tsx    — иконка-ссылка с бейджем
```

### Изменить

| Файл | Что |
| --- | --- |
| `src/shared/types/booking.ts` | `OrderCreateModel` → `{ lines }`, новые `OrderCreateLineModel`, `OrderLinesErrorModel`, `OrderLineErrorItem` (§7.1) |
| `src/shared/api/booking.ts` | doc-комментарий `createOrder`: новый контракт ошибки (2031 + `lines`) |
| `src/features/tours/components/BookingCard.tsx` | submit → «добавить в корзину», вычистить всю логику заказа (§9) |
| `src/features/tours/TourDetailPage.tsx` | импорт `getBookingWindow` из `@/shared/booking` |
| `src/app/router.tsx` | маршрут `cart` (§5.1) |
| `src/app/layout/Header.tsx` | `<CartNavButton />` в служебном кластере перед `<UserMenu />` |
| `src/app/layout/frosted/FrostedRailHeader.tsx` | то же, `<CartNavButton variant="rail" />` |
| `src/shared/ui/icons.tsx` | `BagIcon` |
| `src/shared/ui/GuestStepper.tsx` + `src/shared/ui/index.ts` | новый примитив (§8.3) |
| `src/shared/i18n/dictionary.ts` | блок `cart.*` в `ru` и `en` (§10) |

### Удалить

`src/features/tours/lib/bookingWindow.ts`, `src/features/tours/lib/tourDiscount.ts`,
`src/features/tours/hooks/useTierPrice.ts` (папка `features/tours/lib/` после этого исчезает;
`features/tours/hooks/` остаётся из-за `useTourFilters.ts`).

`MobileTabBar.tsx` и `frosted/FrostedRailDock.tsx` **не трогаем** — см. §8.4.

---

## 3. `src/shared/booking/` (этап 1)

Чистый перенос трёх файлов, содержимое и doc-комментарии сохранить дословно; в doc-комментарии
`useTierPrice.ts` абзац «Feature-local, not shared: the group tier only applies where a live guest
counter exists, which is that one component» заменить на:

> Общий модуль (`shared/booking`, 2026-08): живой счётчик гостей есть теперь и на странице тура, и
> в каждой строке корзины, а фичи не импортируют друг друга. Само ПРАВИЛО тарифных ступеней
> по-прежнему живёт в одном месте — `shared/currency/pricing.ts`; этот хук только композирует
> правило + деньги + условие предоплаты.

`guests.ts` — новый файл, забирает константы, которые сейчас локальны в `BookingCard`:

```ts
/** Границы счётчика гостей, общие для BookingCard и строки корзины. Верхняя граница — продуктовое
 *  правило (группы больше 16 бронируются через менеджера), не ограничение бэкенда: сервер
 *  отвергает только заведомо некорректное значение (errorCode 2015). */
export const MIN_GUESTS = 1
export const MAX_GUESTS = 16

/** Приводит любое число (в т.ч. из localStorage) к допустимому целому в [MIN_GUESTS; MAX_GUESTS]. */
export function clampGuests(value: number): number
```

`index.ts` реэкспортирует всё публичное из четырёх модулей.

---

## 4. Стор корзины `src/shared/cart/` (этап 1)

Идиом — точная копия `shared/currency/currencyStore.ts` / `shared/auth/authStore.ts`:
модульная переменная `state`, `Set<() => void>` слушателей, `setState` заменяет снапшот целиком
(никаких мутаций), биндинг через `useSyncExternalStore`. **Никакого Context и никакого Zustand**
(ADR 022).

### 4.1 `types.ts`

```ts
import type { TourKind } from '@/shared/types/tour'

/**
 * Денормализованный слепок тура на момент добавления. Нужен ТОЛЬКО чтобы `/cart` мог отрисовать
 * список мгновенно (и чтобы удалённый/недоступный тур показывался строкой с названием, а не
 * пустотой). Денег здесь нет намеренно: устаревшая цена в localStorage — худший вид неверных
 * данных, все суммы всегда пересчитываются из свежего `TourDetail`, полученного `cartLoader`.
 */
export interface CartItemSnapshot {
  title: string
  coverImage: string
  kind: TourKind
  durationDays: number
  durationNights: number
}

export interface CartItem {
  /** Идентификатор позиции, стабильный между сессиями. `${tourId}:${tourDate}` — см. §4.3. */
  id: string
  tourId: number
  /** `YYYY-MM-DD`. Никогда не `Date` — см. doc-комментарий `shared/types/booking.ts`. */
  tourDate: string
  guestCount: number
  /** ms epoch. Порядок в списке + отсечение протухших позиций. */
  addedAt: number
  snapshot: CartItemSnapshot
}

/** Снапшот стора. Заменяется целиком; `items` отсортирован по `addedAt` по возрастанию. */
export interface CartState {
  items: readonly CartItem[]
}

export interface AddCartItemInput {
  tourId: number
  tourDate: string
  guestCount: number
  snapshot: CartItemSnapshot
}

/** `'full'` — корзина уже содержит MAX_CART_ITEMS позиций, ничего не добавлено. */
export type AddCartItemResult = 'added' | 'updated' | 'full'
```

### 4.2 `cartStore.ts` — публичный API

```ts
export const CART_STORAGE_KEY = 'hay-travel-cart'
export const CART_STORAGE_VERSION = 1
export const MAX_CART_ITEMS = 10

export function getCartState(): CartState
export function subscribeCart(listener: () => void): () => void

export function addCartItem(input: AddCartItemInput): AddCartItemResult
export function updateCartItem(id: string, patch: { tourDate?: string; guestCount?: number }): void
export function removeCartItem(id: string): void
export function clearCart(): void

/** Позиция для этого тура на эту дату, если она уже в корзине. Для подписи кнопки в BookingCard. */
export function findCartItem(tourId: number, tourDate: string): CartItem | undefined
```

### 4.3 Правила стора (решено, не обсуждается разработчиком)

1. **Ключ позиции — `${tourId}:${tourDate}`.** Не UUID: он обязан быть детерминированным, чтобы
   `addCartItem` для уже существующей пары «тур + дата» **перезаписывал** `guestCount`, а не
   создавал вторую строку. Тот же тур на другую дату — законная отдельная позиция.
   `updateCartItem`, меняющий дату, обязан пересчитать `id`; если получившийся `id` уже занят
   другой позицией — позиции **сливаются**: остаётся одна, с `guestCount` редактируемой строки, а
   вторая удаляется (иначе в корзине появятся два визуально одинаковых ряда).
2. **`addedAt` при перезаписи не обновляется** — позиция не должна прыгать в конец списка от
   изменения числа гостей.
3. **Лимит `MAX_CART_ITEMS = 10`.** При попытке добавить 11-ю — `'full'`, состояние не меняется.
   Обновление существующей позиции лимитом не ограничено. Бэкенд зеркалит этот кап
   (`OrderTooManyLines` 2032, spec 013) — то есть теперь это ограничение размера одного заказа, и
   расходиться значения не имеют права.
4. **Персист в `localStorage`** под `hay-travel-cart` в виде
   `{ version: 1, items: CartItem[] }`. Каждая запись/чтение — в `try/catch`: отказ хранилища
   (Safari private mode) деградирует до «корзина живёт только в этой вкладке», но никогда не
   бросает. Точная калька с `readStoredCurrency`/`writeSeed`.
5. **Санитайзер при чтении** в стиле `sanitizeRates` — не бросать, а выкидывать негодные строки:
   - `version !== 1` → корзина игнорируется целиком (пустая);
   - строка без числового `tourId` / без `tourDate` вида `^\d{4}-\d{2}-\d{2}$` / с непарсящимся
     `snapshot.title` — выкидывается;
   - `guestCount` прогоняется через `clampGuests`;
   - `tourDate < сегодня` (строковое сравнение ISO, без `Date`) → выкидывается: дата уже прошла;
   - `Date.now() - addedAt > 30 дней` → выкидывается;
   - `id` пересобирается из `tourId`/`tourDate`, дубликаты схлопываются (побеждает больший
     `addedAt`);
   - итог обрезается до `MAX_CART_ITEMS`.
6. **Межвкладочная синхронизация.** Модуль вешает `window.addEventListener('storage', …)` и на
   событие с `key === CART_STORAGE_KEY` перечитывает и санитизирует значение, затем `setState`.
   Это не полировка: без этого вкладка A, добавившая позицию, затирает корзину вкладки B при
   следующей записи — реальная потеря данных для сценария «открыть три тура в трёх вкладках».
7. **Выход из аккаунта корзину не трогает** (ADR 022). Никакого мержа с сервером — сервер о
   корзине не знает.

### 4.4 `useCart.ts`

```ts
/** Полный снапшот. Для страницы /cart. */
export function useCart(): CartState
/** Только количество позиций — для бейджа в шапке. */
export function useCartCount(): number
```

Оба — через `useSyncExternalStore(subscribeCart, getCartState, getCartState)`, дословно как
`shared/currency/useCurrency.ts`. `useCartCount` возвращает `useCart().items.length` (число —
примитив, лишних рендеров не даст).

---

## 5. Страница `/cart`

### 5.1 Маршрут

В `src/app/router.tsx`, внутри детей `path: '/'`, рядом с `account`:

```tsx
{
  path: 'cart',
  lazy: () =>
    import('@/features/cart').then((m) => ({ Component: m.CartPage, loader: m.cartLoader })),
},
```

Гарда нет: анонимный посетитель обязан видеть свою корзину (ADR 022).

### 5.2 `cartLoader`

Loader читает стор напрямую (`getCartState()`) — именно ради этого стор модульный, а не в Context.

```ts
export interface CartLoaderData {
  /** Ключ — String(tourId). Отсутствие ключа = тур не найден на бэкенде (удалён/скрыт). */
  tours: Record<string, TourDetail>
  /** Ключ — String(tourId). Закрытые дни в пределах окна бронирования; [] при сбое запроса. */
  closedDates: Record<string, readonly string[]>
  /** Тексты сайта; несёт `largeGroupInvitation` для строк с 7+ гостями. */
  content: ContentText
  window: BookingWindow
}
```

Алгоритм:

1. `const items = getCartState().items` → уникальные `tourId`. Пустая корзина → `tours` и
   `closedDates` пустые, сетевых запросов по турам нет. `getContentText()` вызывается всегда,
   включая пустую корзину: это один дешёвый запрос, зато у страницы один контракт данных без
   nullable-ветки.
2. `const window = getBookingWindow()` — один снапшот на загрузку.
3. Один `Promise.all` по уникальным `tourId`: `getTourInfo(String(id))` и
   `getClosedDates(id, window.fromISO, window.toISO).catch(() => [])`.
   `getTourInfo`, вернувший `undefined`, **не роняет страницу** — ключ просто отсутствует в
   `tours`, строка рендерится как «недоступна» (§6.3). Тот же контракт «доступность никогда не
   роняет страницу», что в `tourDetailLoader`.
4. `getContentText()` едет в том же `Promise.all` (он не реджектится по контракту).

Loader **не перезапускается** при редактировании даты/гостей и это правильно: `TourDetail` несёт
весь `discountWindow`, а `closedDates` покрывает всё трёхмесячное окно — то есть данных хватает на
любую дату, которую посетитель может выбрать. Перезапрашивать нечего.

Единственный случай, когда данных не хватает: позиция появилась из другой вкладки после загрузки
страницы. Обработка — в `CartPage`: `useEffect`, который вызывает `useRevalidator().revalidate()`,
если в `items` есть `tourId`, которого нет ни в `tours`, ни в списке «уже подтверждённо
отсутствующих» (иначе получится цикл ревалидации на удалённом туре). Хранить множество
`missingTourIds` в `useRef`.

### 5.3 Состояния страницы (приоритет сверху вниз)

1. **Заказ создан** (`checkout.result !== null`) → `CheckoutResultPanel` с номером заказа.
   Корзина в этот момент уже пуста (`clearCart()` вызван при успехе), поэтому это состояние
   обязано выигрывать у ветки «корзина пуста».
2. **Корзина пуста** → `CartEmptyState` (иконка, текст, кнопка «Смотреть путешествия» → `/trips`).
3. **Обычный список** → строки + `CartSummary`. Отклонённые позиции показываются в этом же
   состоянии, с ошибкой инлайн на своей строке (§6.4) — отдельного экрана «отклонено» нет.

Состояния «частичный успех» **не существует** (ADR 025): заказ либо создан целиком, либо не создан
вовсе.

---

## 6. `CartLineCard` — контракт

```tsx
export interface CartLineCardProps {
  item: CartItem
  /** `undefined` — тур не отдался бэкендом; строка рендерится в режиме «недоступен» (§6.3). */
  tour: TourDetail | undefined
  /** Закрытые дни этого тура (из loader) + даты, отклонённые сервером в этой сессии (§7.5). */
  disabledDates: ReadonlySet<string>
  window: BookingWindow
  largeGroupInvitation: string
  /** Причина, по которой сервер отклонил именно эту позицию на последней попытке (§6.4).
   *  `null` — позиция в порядке. */
  error: CheckoutLineFailureReason | null
  /** Идёт запрос — вся строка недоступна для редактирования. */
  disabled: boolean
  onChangeDate: (itemId: string, date: string) => void
  onChangeGuests: (itemId: string, guests: number) => void
  onRemove: (itemId: string) => void
}
```

Компонент — «глупый»: своего состояния, кроме локального UI-фокуса, не держит, всё поднимает
наверх в `CartPage`, который единственный мутирует стор.

### 6.1 Содержимое строки

- обложка `item.snapshot.coverImage` (при наличии `tour` — `tour.coverImage`, он свежее);
- заголовок — ссылка на `/tours/${item.tourId}`;
- `KindChip` + `formatDuration(...)` — уже есть в `shared/ui` и `shared/lib/format`;
- `DatePicker` — те же пропсы, что в `BookingCard`: `max={window.toISO}`,
  `disabledDates`, `discountRange` из `tour.discountWindow`, `surface` — публичный;
- `GuestStepper` (§8.3);
- цена строки: `useTierPrice(tour.priceFrom, item.guestCount, discountedForDate)`, где
  `discountedForDate = discountedPriceOn(tour.priceFrom, tour.discountWindow, item.tourDate)`.
  **Ветка `hidden` (7+ гостей)**: вместо цены — `largeGroupInvitation`, ровно как в `BookingCard`;
- кнопка удаления (`TrashIcon`), `aria-label` из словаря.

### 6.2 Дата в корзине обязана быть

В отличие от `BookingCard`, позиция корзины **не может** существовать без даты: она задаётся при
добавлении и входит в `id` позиции. Поэтому в строке нет состояния «дата не выбрана» — есть только
состояние «дата отклонена сервером» (§6.4).

### 6.3 Строка «тур недоступен» (`tour === undefined`)

Показать название из `snapshot`, приглушённо, текст `cart.line.unavailable`, скрыть дату/гостей/
цену, оставить только кнопку удаления. Такая позиция **блокирует** кнопку чекаута (§8.1): отправить
её всё равно нельзя — бэкенд отобьёт весь заказ кодом `TourNotFound` (2004), а с атомарным чекаутом
это означает «не отправится вообще ничего».

### 6.4 Строка с ошибкой валидации (`error !== null`)

После неуспешной попытки отправки строка получает свою причину и показывает её инлайн под полями
(`role="alert"`), а `DatePicker` переходит в состояние `error` для причин, связанных с датой.
Позиция из корзины **не удаляется** — заказ не создан, терять нечего.

Ошибка строки снимается, как только посетитель что-то в ней меняет (`onChangeDate` /
`onChangeGuests`) — иначе кнопка отправки останется заблокированной навсегда.

Копия по причинам — §7.4.

---

## 7. Чекаут — `hooks/useCheckout.ts`

**Один вызов `createOrder()` со всеми позициями. Никакого цикла по позициям, никакого частичного
успеха** (ADR 025). Реализация «цикл + N запросов» прямо запрещена.

### 7.1 Wire-типы (`src/shared/types/booking.ts`)

Правится существующий `OrderCreateModel`, добавляются три типа. Doc-комментарий модуля («A booking
from the PUBLIC site is still always exactly one line — `OrderCreateModel` is unchanged») —
переписать, он стал неверным.

```ts
/** Одна позиция корзины в теле `POST api/Order/Create` (spec 013). */
export interface OrderCreateLineModel {
  tourId: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
}

/** `POST api/Order/Create` (ADR 025). Создаёт ОДИН заказ с N строками, атомарно: либо все строки,
 * либо ни одной. No `userId`: сервер берёт владельца из токена, никогда из тела (IDOR guard).
 * 1..10 строк; пустой список — 2028, больше десяти — 2032. */
export interface OrderCreateModel {
  lines: OrderCreateLineModel[]
}

/** Один пункт пер-строчного отказа валидации. `index` — 0-based позиция строки В ОТПРАВЛЕННОМ
 * массиве `lines`, порядок сервер сохраняет. */
export interface OrderLineErrorItem {
  index: number
  tourId: number
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
```

`shared/api/booking.ts`: сигнатура `createOrder(model: OrderCreateModel): Promise<OrderInfoModel>`
формально не меняется, но doc-комментарий обязан описать новый контракт отказа — «rejects with
`ApiError` carrying `errorCode` 2031 plus a per-line `lines` array (2004/2014/2015/2016), or a flat
2028/2032 for a malformed request, or `SessionExpiredError`».

### 7.2 Типы хука

```ts
export type CheckoutLineFailureReason =
  | 'tourNotFound'      // 2004
  | 'dateUnavailable'   // 2014
  | 'guestCount'        // 2015
  | 'datePast'          // 2016
  | 'unknown'           // код есть, но нам неизвестен

export interface CheckoutResult {
  /** Номер СОЗДАННОГО заказа — ровно один на всю корзину. */
  orderNumber: string
}

export interface UseCheckout {
  running: boolean
  /** Ошибки по `CartItem.id`. Непусто только после неуспешной попытки; чистится по мере правок. */
  lineErrors: ReadonlyMap<string, CheckoutLineFailureReason>
  /** Ошибка, не привязанная к строке: сеть, 5xx, 2028/2032, нераспознанное тело. Готовая копия. */
  formError: string | null
  result: CheckoutResult | null
  /** Анонимный посетитель нажал «Отправить» — показать блок входа. */
  authNotice: boolean
  submit: (items: readonly CartItem[]) => Promise<void>
  /** Снять ошибку конкретной строки (вызывается из onChangeDate/onChangeGuests). */
  clearLineError: (itemId: string) => void
}
```

### 7.3 Алгоритм `submit`

```
if (running) return
const { status } = getAuthState()
if (status !== 'authenticated' && status !== 'anonymous') return   // сессия ещё грузится
if (status === 'anonymous') { authNotice = true; return }          // сети не касаемся

running := true; formError := null; lineErrors := пусто

// Порядок массива = порядок items и должен быть зафиксирован: index в ответе указывает в НЕГО.
const submitted = [...items]

try:
  order = await createOrder({
    lines: submitted.map(i => ({ tourId: i.tourId, tourDate: i.tourDate, guestCount: i.guestCount })),
  })
  clearCart()                       // заказ создан целиком — корзине больше нечего хранить
  result = { orderNumber: order.number }
catch (err):
  разбор в §7.4
finally:
  running := false
```

Ничего не удаляется из корзины до успеха и ничего не удаляется при ошибке. Защита от дублей —
только флаг `running` + `disabled` на кнопке: повторная отправка не может уйти, пока идёт первая, а
после успеха корзина пуста и отправлять уже нечего.

### 7.4 Разбор ошибки — `lib/checkoutErrors.ts`

Переезжает из `BookingCard.tsx` (строки 50–80 текущего файла) `errorCodeOf(body)` — читатель,
понимающий и `errorCode`, и `ErrorCode` (разные обработчики на бэке пишут по-разному). Добавляются:

```ts
export const ORDER_HAS_INVALID_LINES = 2031
export const ORDER_TOO_MANY_LINES = 2032
export const ORDER_MUST_HAVE_AT_LEAST_ONE_LINE = 2028

/** Пер-строчные ошибки из тела 400. Пустой массив — тело не в формате `OrderLinesErrorModel`. */
export function orderLineErrorsOf(body: unknown): readonly OrderLineErrorItem[]

export function lineFailureReason(errorCode: number): CheckoutLineFailureReason
export function lineFailureMessage(reason: CheckoutLineFailureReason, t: Translate): string
/** Копия для `formError`: сессия, сеть, 2028/2032, всё нераспознанное. */
export function checkoutFormMessage(err: unknown, t: Translate): string
```

Ветвление в `catch`:

| Условие | Что делаем |
| --- | --- |
| `SessionExpiredError` или `ApiError.status === 401` | `authNotice = true`, `formError = t('booking.sessionExpired')`. Корзина цела, никуда не редиректим сами — посетитель жмёт ссылку в блоке входа (§8.1) |
| `ApiError`, код 2031 | Разложить `lines` по позициям (§7.5), заполнить `lineErrors`. `formError` — `null`: причины уже видны на строках, дублировать их общим баннером не нужно |
| `ApiError`, код 2032 | `formError = t('cart.error.tooManyLines')`. Недостижимо при исправном клиентском капе — обрабатываем как рассинхрон клиента и сервера, а не как «этого не бывает» |
| `ApiError`, код 2028 | `formError = t('booking.submitFailed')`. Недостижимо (кнопка недоступна при пустой корзине) |
| всё остальное | `formError = t('booking.submitFailed')` |

Маппинг пер-строчных кодов в копию — существующие ключи, новых текстов не выдумывать:

| Код | `CheckoutLineFailureReason` | Ключ |
| --- | --- | --- |
| 2004 | `tourNotFound` | `cart.line.unavailable` |
| 2014 | `dateUnavailable` | `booking.dateUnavailable` |
| 2015 | `guestCount` | `cart.line.guestCountInvalid` |
| 2016 | `datePast` | `booking.datePast` |
| прочее | `unknown` | `booking.submitFailed` |

### 7.5 Сопоставление ответа с позициями корзины

**Первичный ключ — `index`**, указывающий в зафиксированный массив `submitted` (не в текущий стор:
между отправкой и ответом другая вкладка могла что-то изменить). **`tourId` + `tourDate` — это
контрольная сумма, а не первичный ключ.**

```
для каждого lineError из ответа:
  candidate := submitted[lineError.index]
  если candidate существует И candidate.tourId === lineError.tourId
                            И candidate.tourDate === lineError.tourDate:
      → lineErrors[candidate.id] = lineFailureReason(lineError.errorCode)
  иначе:
      // запасной путь: id позиции детерминирован (§4.3 п.1), поэтому его можно собрать
      fallbackId := `${lineError.tourId}:${lineError.tourDate}`
      если позиция с таким id есть в текущей корзине → пометить её
      иначе → поднять formError = t('booking.submitFailed') (ответ не удалось разложить)
```

Почему именно так: `index` определён контрактом (spec 013 §3 — сервер сохраняет порядок строк) и
однозначен; сверка по паре «тур + дата» ловит гипотетическое переупорядочивание на бэке, не полагаясь
на него. Оба варианта работают только потому, что `id` позиции у нас детерминирован — вторая
причина, по которой §4.3 запрещает UUID.

Дополнительно при `reason === 'dateUnavailable' | 'datePast'` `CartPage` добавляет эту дату в
`serverClosed[tourId]` (`useState<Record<string, readonly string[]>>`), чтобы `DatePicker` этой
строки закрасил день как недоступный и повторно выбрать его было невозможно. Это калька
`serverClosed` из сегодняшнего `BookingCard`, переехавшая на уровень страницы, потому что закрытые
дни принадлежат туру, а не строке (две строки одного тура должны видеть один и тот же набор).

### 7.6 Что было в ред. 1 и чего больше нет

Последовательный цикл по позициям, `CartItemSubmitState` с `'submitting'`/`'created'`, `snapshots`
уже отправленных строк, поштучный `removeCartItem` внутри цикла, `CheckoutOutcome` с
`'partial'`/`'noneCreated'`/`'sessionLost'`, правило «созданный заказ не откатывается», прерывание
цикла по 401. Всё это удалено вместе с исходом «частичный успех».

---

## 8. `CartSummary`, шапка, примитивы

### 8.1 `CartSummary`

```tsx
export interface CartSummaryProps {
  itemCount: number
  /** Готовые строки из useCartTotal. */
  total: string | null
  /** true — хотя бы одна позиция с 7+ гостями, итог неполный. */
  hasQuoteOnlyLines: boolean
  /** Причина блокировки CTA, или null — можно отправлять. */
  blockedBy: 'unavailableTour' | 'lineErrors' | 'sessionUnknown' | null
  running: boolean
  /** Не привязанная к строке ошибка последней попытки. */
  formError: string | null
  authNotice: boolean
  onSubmit: () => void
}
```

- CTA — золотая кнопка того же класса, что submit в `BookingCard` (включая `btn-sheen` только в
  активном состоянии). Подпись всегда `cart.summary.submit` / `cart.summary.submitting`: варианта
  «отправить оставшиеся» больше нет, потому что «оставшихся» не бывает.
- `authNotice` рендерит тот же блок, что сейчас в `BookingCard` (заголовок + текст + вторичная
  ссылка), но ссылка — `withReturnTo('/auth', '/cart')` **без каких-либо query-параметров**:
  корзина в localStorage переживает поход на `/auth` сама.
- `blockedBy !== null` → кнопка `disabled` + поясняющая подпись под ней. `'lineErrors'`
  выставляется, пока хоть у одной позиции есть неснятая ошибка (§6.4); правка строки её снимает и
  кнопка снова активна.
- `formError` — `role="alert"` под кнопкой.

### 8.2 `useCartTotal.ts`

```ts
export interface CartTotalView {
  /** Отформатированная сумма в валюте посетителя; null — все позиции «по запросу». */
  total: string | null
  /** Отформатированная сумма БЕЗ скидок; null — скидок нет ни на одной позиции. */
  originalTotal: string | null
  /** true — часть позиций не имеет отображаемой цены (7+ гостей). */
  hasQuoteOnlyLines: boolean
}

export function useCartTotal(
  items: readonly CartItem[],
  tours: Record<string, TourDetail>,
): CartTotalView
```

**Правило округления — жёсткое (ADR 008/009): суммировать в AMD, конвертировать и форматировать
ровно один раз в конце.** Складывать отформатированные строки или конвертированные значения
запрещено. Для каждой позиции:
`applyGroupTier(discountedPriceOn(tour.priceFrom, tour.discountWindow, item.tourDate) ?? tour.priceFrom, item.guestCount).amountAmd`;
`null` (7+) — пропускается и поднимает `hasQuoteOnlyLines`. Позиции без `tour` пропускаются.
Форматирование — `useMoney().format(sumAmd)` один раз.

Отображаемый итог остаётся справочным: сервер считает свою сумму сам и не знает про тарифную
ступень 5–6 гостей (это уже задокументировано в `BookingCard`), корзина этого не исправляет.

### 8.3 `GuestStepper` (`shared/ui`)

Точное извлечение разметки счётчика из `BookingCard` (строки 328–349 текущего файла) в
переиспользуемый примитив — иначе корзина повторит тот же доступный степпер второй раз.

```tsx
export interface GuestStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number   // default MIN_GUESTS
  max?: number   // default MAX_GUESTS
  /** 'md' — текущий вид BookingCard (h-9 w-9); 'sm' — компактный, для строки корзины. */
  size?: 'md' | 'sm'
  labelFewer: string
  labelMore: string
  disabled?: boolean
}
```

Клампинг внутри — через `clampGuests` из `@/shared/booking`. Экспорт добавить в
`shared/ui/index.ts` в группу «Public site only». `BookingCard` после этого использует примитив, а
не свою разметку — визуально `md` обязан быть пиксель-в-пиксель прежним.

### 8.4 Иконка в шапке — `app/layout/CartNavButton.tsx`

```tsx
export interface CartNavButtonProps {
  /** Как у UserMenu: меняет только класс триггера, не структуру. */
  variant?: 'capsule' | 'rail'
}
```

- `NavLink to="/cart"`, внутри `BagIcon` + бейдж-счётчик.
- Бейдж при `count === 0` не рендерится вовсе; при `count > 9` — `9+`.
- `aria-label` — `cart.nav.aria` с подстановкой `{count}`; сам бейдж `aria-hidden`.
- Данные — `useCartCount()` из `@/shared/cart`.

Размещение: в служебном кластере **обеих** шапок, непосредственно перед `<UserMenu />`
(`Header.tsx` — внутри `div.ml-auto`; `FrostedRailHeader.tsx` — между `RailSegmentedControl` и
`UserMenu`). Виден на **всех** брейкпоинтах, без `lg:`-гейта — по той же логике, по которой там же
живёт `CurrencySwitch`.

**В нижние мобильные бары (`MobileTabBar`, `FrostedRailDock`) корзина НЕ добавляется.** Оба
документированно являются четырьмя навигационными вкладками (`grid-cols-4`, капсула на 375px), и
пятая вкладка ломает заявленный контракт и вёрстку обоих скинов. Мобильная точка входа — иконка в
шапке.

### 8.5 `BagIcon`

Новая функция в `shared/ui/icons.tsx` по существующей конвенции (`IconProps`, `Icon`-обёртка,
24×24 viewBox, stroke). Форма — классическая сумка/tote (прямоугольник со скруглением + дужка),
не «тележка супермаркета»: это заявка на путешествие, а не e-commerce чекаут.

---

## 9. `BookingCard` — что меняется

### 9.1 Остаётся без изменений

Вся форма: блок цены (включая `originalTotal`, `prepayment`, ветку `hidden` c
`largeGroupInvitation`, чип «малая группа»), `DatePicker` с `discountRange` и `disabledDates`,
счётчик гостей (теперь через `GuestStepper`), `initialDateFromQuery`/`initialGuestsFromQuery`
(оставить: дают дип-линк на тур с предвыбранной датой; удалять работающий код не за что),
`getBookingWindow`, `discountedPriceOn`, `useTierPrice`.

Пропсы `BookingCardProps` не меняются.

### 9.2 Удаляется целиком

`createOrder`/`OrderInfoModel`/`SessionExpiredError`/`ApiError` импорты, состояния `pending`,
`error`, `authNotice`, `order`, `serverClosed`, ветка рендера «заявка отправлена»,
`errorCodeOf`/`bookingErrorMessage` (переезжают в `features/cart/lib/checkoutErrors.ts`),
константы 2014/2015/2016, `useAuth()` и вся проверка `isAuthKnown`, блок «Нужен вход в аккаунт» со
ссылкой `withReturnTo`.

`disabledDates` становится просто `useMemo(() => new Set(closedDates), [closedDates])`.

После этой правки `BookingCard` не делает ни одного сетевого запроса и ничего не знает про
авторизацию — вся связь с бэкендом на публичном сайте сходится в один вызов на `/cart`.

### 9.3 Новое поведение

```
handleSubmit:
  if (date === '') { setDateMissing(true); return }
  result = addCartItem({
    tourId: Number(tour.id),
    tourDate: date,
    guestCount: guests,
    snapshot: { title: tour.title, coverImage: tour.coverImage, kind: tour.kind,
                durationDays: tour.durationDays, durationNights: tour.durationNights },
  })
  if (result === 'full') { setCartFull(true); return }
  setAdded(result)   // 'added' | 'updated'
```

Локальные состояния вместо удалённых: `added: 'added' | 'updated' | null`, `cartFull: boolean`.

**Подтверждение после добавления — инлайн, БЕЗ автоперехода на `/cart`.** Автопереход превратил
бы корзину в тот же одношаговый флоу, который мы убираем, и уничтожил бы весь смысл накопления.
Показываем поверх кнопки (или вместо неё — решает дизайнер) полосу подтверждения:

- заголовок: `cart.added.title` («Добавлено в корзину») либо `cart.added.titleUpdated`
  («Обновлено в корзине») в зависимости от `added`;
- основная ссылка → `/cart`, текст `cart.added.goToCart`;
- вторичная кнопка `cart.added.continue` — сбрасывает `added` в `null` и возвращает форму
  (посетитель может выбрать другую дату этого же тура и добавить вторую позицию).

Форма при `added !== null` **не размонтируется**: выбранные дата/гости остаются на месте.

`cartFull` — сообщение `cart.error.full` под кнопкой, `role="alert"`, кнопка остаётся активной.

Подпись кнопки: `cart.addToCart` во всех тарифных ветках, включая 7+. Подсказка под кнопкой —
прежняя пара `booking.submitHint` / `booking.submitHintLargeGroup`.

---

## 10. Ключи словаря (`shared/i18n/dictionary.ts`, блок `// ── Cart ──`)

RU — источник истины, EN обязателен (иначе билд упадёт). Русские тексты ниже — финальные, EN на
усмотрение разработчика по смыслу.

| Ключ | RU |
| --- | --- |
| `cart.nav.aria` | `Корзина, позиций: {count}` |
| `cart.title` | `Корзина` |
| `cart.subtitle` | `Проверьте даты и число гостей — заявку отправим одним нажатием` |
| `cart.addToCart` | `Добавить в корзину` |
| `cart.added.title` | `Добавлено в корзину` |
| `cart.added.titleUpdated` | `Обновлено в корзине` |
| `cart.added.goToCart` | `Перейти в корзину` |
| `cart.added.continue` | `Продолжить выбор` |
| `cart.error.full` | `В корзине максимум 10 позиций — отправьте заявку или удалите лишнее` |
| `cart.error.tooManyLines` | `В одной заявке не больше 10 позиций — удалите лишнее и попробуйте снова` |
| `cart.empty.title` | `Корзина пуста` |
| `cart.empty.body` | `Выберите путешествие, укажите дату и число гостей — они появятся здесь` |
| `cart.empty.action` | `Смотреть путешествия` |
| `cart.line.remove` | `Удалить из корзины` |
| `cart.line.unavailable` | `Это путешествие больше недоступно — удалите его, чтобы отправить заявку` |
| `cart.line.guestCountInvalid` | `Недопустимое число гостей — измените и попробуйте снова` |
| `cart.summary.total` | `Итого` |
| `cart.summary.quoteNote` | `По части позиций стоимость рассчитаем индивидуально` |
| `cart.summary.submit` | `Отправить заявку` |
| `cart.summary.submitting` | `Отправляем…` |
| `cart.summary.blockedUnavailable` | `Удалите недоступные путешествия, чтобы продолжить` |
| `cart.summary.blockedLines` | `Исправьте отмеченные позиции и отправьте заявку снова` |
| `cart.summary.hint` | `Заявка без оплаты — подтвердим и пришлём детали` |
| `cart.summary.rejectedNote` | `Заявка не создана — ни одна позиция не отправлена` |
| `cart.auth.title` | `Нужен вход в аккаунт` |
| `cart.auth.body` | `Войдите — корзина сохранится, ничего выбирать заново не придётся` |
| `cart.auth.action` | `Войти и продолжить` |
| `cart.result.title` | `Заявка отправлена` |
| `cart.result.body` | `Мы свяжемся с вами в течение дня и подтвердим даты. Предоплата — после подтверждения.` |
| `cart.result.orderNumber` | `Заказ №{number}` |
| `cart.result.lineCount` | `Позиций в заявке: {count}` |
| `cart.result.continue` | `Смотреть другие путешествия` |

`cart.summary.rejectedNote` — важная строка: при пер-строчном отказе посетитель обязан понять, что
частично ничего не ушло и повторная отправка не создаст дубль.

Существующие `booking.*` не переименовываем и не удаляем: `booking.dateUnavailable`,
`booking.datePast`, `booking.submitFailed`, `booking.sessionExpired`, `booking.total`,
`booking.prepayment`, `booking.guests*`, `booking.dateLabel`, `booking.submitHint*` продолжают
использоваться обеими сторонами. Ставшие мёртвыми `booking.submit`, `booking.submitLargeGroup`,
`booking.submitted*`, `booking.orderNumber`, `booking.editSubmission`, `booking.auth*`,
`booking.submitting` — **удалить** из обоих словарей в том же коммите (мёртвая копия хуже
дублирующейся).

---

## 11. Что уходит дизайнеру

`designer` уже отдал мокапы по ред. 1. Актуализация:

**Невалидно, переделывать не нужно — просто выбросить:** экран «частичный успех» (принятые номера
сверху + отклонённые строки снизу). Такого исхода больше не существует (ADR 025).

**Остаются валидными как есть:** пустая корзина, обычный список, строка в процессе отправки,
полоса подтверждения в `BookingCard`, иконка корзины с бейджем, экран успеха (нужно лишь убедиться,
что он показывает ОДИН номер заказа, а не список номеров).

**Нужно добрать одно состояние:** отказ по строкам — список остаётся на месте, у отклонённых строк
инлайн-причина (`role="alert"`) и подсвеченный `DatePicker`, сверху или у кнопки — заметная строка
`cart.summary.rejectedNote` («заявка не создана, ничего не отправлено»). Это состояние заменяет
собой выброшенный «частичный успех» и по смыслу проще: ничего не создано, всё поправимо на месте.

**Остаётся визуально рискованным:** служебный кластер `Header` на 375px — там уже валюта + язык +
тема + `UserMenu`, и пятый элемент тесен. Что уступает место (сжатие словесного знака, бейдж-точка
вместо числа, схлопывание чего-то в `RailSegmentedControl`-подобный трек) — решает дизайнер.

Дизайнер **не** решает: структуру стора, контракт loader'а, формат запроса/ответа чекаута, тексты
ошибок (они зафиксированы в §10).

---

## 12. Явно вне скоупа

- **Бэкенд.** Изменение `POST api/Order/Create` — отдельная задача, [spec 013](013-cart-checkout-backend.md),
  зона `backend-architect`/`backend-developer`. Здесь мы только потребители контракта.
- «Добавить в корзину» с карточки каталога (`TourCard`) и с главной: дата обязательна для каждой
  позиции, а у карточки нет календаря.
- Серверная корзина, синхронизация корзины между устройствами, мерж при входе.
- Экран «мои заказы» для посетителя (его сегодня нет; номер показывается только на экране
  результата чекаута).
- Оплата и предоплата как действие — блок предоплаты остаётся справочным, как сейчас.
- Выпадающая панель/drawer корзины — решено: только страница `/cart`.
- Промокоды, скидка за количество позиций, любая агрегирующая скидка по корзине.
- Совпадение отображаемого итога с суммой, которую посчитает сервер (§8.2).
- Частичная отправка корзины, «отправить только выбранные позиции», черновики заявок — прямо
  противоречит атомарности из ADR 025.
