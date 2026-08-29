/**
 * Public booking API — day availability and order creation.
 *
 * No wire→domain mapping here, deliberately (unlike `shared/api/tours.ts`, which maps a fat admin
 * DTO onto a lean public model): these two payloads are already the shape the call sites use, and
 * a pass-through mapper would only be a second place to keep in sync.
 *
 * The one module in `shared/api/*` that mixes both transports: `getClosedDates` is public
 * (`apiFetch`), `createOrder` requires a signed-in visitor (`authFetch`, which takes the user id
 * from the token — the body never carries it).
 *
 * No `try/catch` in here on purpose: the error policy differs per caller. `tourDetailLoader` and
 * `cartLoader` swallow a failed `getClosedDates` (availability must not take a page down), while
 * `features/cart`'s checkout maps `createOrder`'s error codes to visible copy.
 */

import { apiFetch } from '@/shared/lib/http'
import { authFetch } from '@/shared/auth'
import type { OrderCreateModel, OrderInfoModel, TourGroupSeatsModel } from '@/shared/types/booking'

/**
 * Days closed for this tour within `[from, to]` (inclusive), as flat `YYYY-MM-DD` strings.
 *
 * The server resolves global + tour-scoped rules into concrete dates per request (ADR 012) —
 * order and uniqueness are not guaranteed, so the caller drops them into a `Set`.
 */
export function getClosedDates(tourId: number, from: string, to: string): Promise<string[]> {
  return apiFetch<string[]>(
    `api/Availability/GetClosedDates?tourId=${tourId}&from=${from}&to=${to}`,
  )
}

/**
 * Остаток мест группового формата на `[from, to]` (решения 0.19/0.20, батч 2026-08-29).
 *
 * Запрашивается ПАРОЙ с `getClosedDates` — это два ответа на один и тот же вопрос «можно ли
 * сюда бронировать», и блок брони нуждается в обоих сразу. Публичный, как и закрытые даты:
 * гасить занятые слоты сайт обязан ещё до логина.
 *
 * `slots` в ответе — только слоты С БРОНЯМИ; отсутствие даты означает «свободно всё»
 * (см. `TourGroupSeatsModel`). Разбор ответа — `shared/booking/groupSeats.ts`, чтобы
 * «мест осталось» считалось в одном месте, а не в каждом вызывающем.
 */
export function getGroupSeats(tourId: number, from: string, to: string): Promise<TourGroupSeatsModel> {
  return apiFetch<TourGroupSeatsModel>(
    `api/Availability/GetGroupSeats?tourId=${tourId}&from=${from}&to=${to}`,
  )
}

/**
 * Creates ONE order carrying the visitor's whole cart, atomically (ADR 025 / spec 013): either
 * every line is written or none is, and the answer always names exactly one order number.
 *
 * Rejects with:
 *  - `ApiError` carrying `errorCode` 2031 (`OrderHasInvalidLines`) plus a per-line `lines` array
 *    whose entries hold their own 2004 / 2014 / 2015 / 2016 code — nothing was created;
 *  - `ApiError` carrying a FLAT 2028 (no lines) / 2032 (more than ten lines) — the request itself
 *    was malformed, so there is no per-line breakdown;
 *  - `SessionExpiredError` when the session could not be renewed.
 *
 * `features/cart/lib/checkoutErrors.ts` owns the reading of all of that.
 */
export function createOrder(model: OrderCreateModel): Promise<OrderInfoModel> {
  return authFetch<OrderInfoModel>('api/Order/Create', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}
