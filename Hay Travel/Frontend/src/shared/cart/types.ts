/**
 * Cart wire/shape types (spec 008 §4.1).
 *
 * A cart item is a CLIENT-side value: it never crosses the network in this shape. What goes to the
 * server on checkout is `OrderCreateLineModel` (`shared/types/booking.ts`), assembled from these
 * three fields — `tourId` + `tourDate` + `guestCount` — and nothing else.
 */

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
