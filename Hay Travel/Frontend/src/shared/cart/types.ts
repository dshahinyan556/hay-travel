/**
 * Cart wire/shape types (spec 008 §4.1).
 *
 * A cart item is a CLIENT-side value: it never crosses the network in this shape. What goes to the
 * server on checkout is `OrderCreateLineModel` (`shared/types/booking.ts`), assembled from these
 * three fields — `tourId` + `tourDate` + `guestCount` — and nothing else.
 */

import type { TourKind } from '@/shared/types/tour'
import type { TourFormat } from '@/shared/types/tourFormat'

/**
 * Денормализованный слепок продукта на момент добавления. Нужен ТОЛЬКО чтобы `/cart` мог
 * отрисовать список мгновенно (и чтобы удалённый/недоступный продукт показывался строкой с
 * названием, а не пустотой). Денег здесь нет намеренно: устаревшая цена в localStorage — худший
 * вид неверных данных, все суммы всегда пересчитываются из свежего продукта, полученного
 * `cartLoader`.
 */
export interface CartItemSnapshot {
  title: string
  coverImage: string
  kind: TourKind
  /** У трансфера длительности нет — обе величины 0, строка её и не показывает. */
  durationDays: number
  durationNights: number
}

/**
 * Выбор, который делает посетитель на странице ПРЕДОПРЕДЕЛЁННОГО трансфера (решения 0.6/0.10).
 *
 * Живёт отдельным объектом, а не пятью полями рядом с `tourId`, ровно чтобы `transfer !== null`
 * читалось как «это позиция-трансфер»: у трансфера другая цена (класс авто, а не тир по гостям),
 * другая строка в корзине и другие поля в теле заказа.
 *
 * Дата и время подачи в объект НЕ входят: это `tourDate` и `startTime` самой позиции — у
 * трансфера они значат ровно то же, что у брони продукта, и дублировать их значило бы завести
 * второй источник правды для ключа позиции.
 */
export interface CartTransferSelection {
  /** Класс авто, чья цена и есть цена позиции. Обязателен (`VehicleClassNotAvailable`/2047). */
  vehicleClassId: number
  isRoundTrip: boolean
  /** `YYYY-MM-DD`; заполнено ровно при `isRoundTrip`. */
  returnDate: string | null
  /** Каноничный `HH:mm`; заполнено ровно при `isRoundTrip`. */
  returnTime: string | null
}

export interface CartItem {
  /** Идентификатор позиции, стабильный между сессиями. `${tourId}:${tourDate}:${startTime}` —
   * см. §4.3 и комментарий `itemId` в `cartStore.ts` (время старта вошло в ключ 2026-08-29:
   * один продукт в один день в 09:00 и в 14:00 — два разных выезда). */
  id: string
  tourId: number
  /** `YYYY-MM-DD`. Никогда не `Date` — см. doc-комментарий `shared/types/booking.ts`. */
  tourDate: string
  guestCount: number
  /** Выбранное время старта, каноничный `HH:mm` (`shared/booking/startTime.ts`). Обязательно:
   * позиции без слота не существует — решение 0.28. */
  startTime: string
  /** Формат, выбранный посетителем. Заполнен, только когда продукт продаётся в ОБОИХ форматах;
   * `null` — «выбирать было нечего», и эффективный формат берётся у самого продукта
   * (`resolveEffectiveFormat`). Хранить решение клиента обязательно: от него зависит цена. */
  format: TourFormat | null
  /** Непусто — позиция это ПРЕДОПРЕДЕЛЁННЫЙ ТРАНСФЕР (батч 2026-08-29). `null` — обычная бронь
   * тура/экскурсии. Дискриминант строки: от него зависит и расчёт цены, и вид карточки в
   * корзине, и поля, уезжающие в `OrderCreateLineModel`. */
  transfer: CartTransferSelection | null
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
  /** Каноничный `HH:mm`. Пустая строка сюда не попадает: блок брони не даёт отправить форму
   * без выбранного слота, а стор такую позицию отбрасывает при чтении из localStorage. */
  startTime: string
  /** `null` — продукт продаётся только в одном формате, выбирать было нечего. */
  format: TourFormat | null
  /** `null`/опущено — позиция по туру или экскурсии. */
  transfer?: CartTransferSelection | null
  snapshot: CartItemSnapshot
}

/** `'full'` — корзина уже содержит MAX_CART_ITEMS позиций, ничего не добавлено. */
export type AddCartItemResult = 'added' | 'updated' | 'full'
