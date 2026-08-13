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
 * No `try/catch` in here on purpose: the error policy differs per caller. `tourDetailLoader`
 * swallows a failed `getClosedDates` (availability must not take the tour page down), while
 * `BookingCard` maps `createOrder`'s error codes to visible copy.
 */

import { apiFetch } from '@/shared/lib/http'
import { authFetch } from '@/shared/auth'
import type { OrderCreateModel, OrderInfoModel } from '@/shared/types/booking'

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

/** Creates an order for the SIGNED-IN visitor. Rejects with `ApiError` carrying `errorCode`
 * 2014 (date unavailable) / 2015 (guest count) / 2016 (date in the past), or with
 * `SessionExpiredError` when the session could not be renewed. */
export function createOrder(model: OrderCreateModel): Promise<OrderInfoModel> {
  return authFetch<OrderInfoModel>('api/Order/Create', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}
