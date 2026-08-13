/**
 * Admin Orders API — `api/Order`.
 *
 * `Order/Create` is the visitor's own action and belongs to `shared/api/booking.ts`;
 * `Order/GetMine` exists server-side but has no UI yet (spec 003 §8), and a wrapper nobody
 * calls is dead code — add it with the screen that needs it.
 *
 * `GetAll`/`Confirm`/`Update` are `[Authorize(Roles = "Admin")]`; `Cancel` also accepts the
 * order's own owner, but this file only ever calls it as the admin. All mirrored client-side
 * by `canManageCalendar` (`OrdersPage`'s loader gate).
 */

import { authFetch } from '@/shared/auth'
import type { OrderInfoModel, OrderStatus, OrderUpdateModel } from '@/shared/types/booking'

export interface OrderListFilters {
  tourId?: number
  /** `YYYY-MM-DD`, inclusive. */
  from?: string
  /** `YYYY-MM-DD`, inclusive. */
  to?: string
  status?: OrderStatus
}

/**
 * GET the admin order list. Every filter is optional; tour titles come back in Russian.
 *
 * @param signal optional `AbortSignal` — see `getCalendarMonth`, the two are requested together.
 */
export function getOrders(
  filters?: OrderListFilters,
  signal?: AbortSignal,
): Promise<OrderInfoModel[]> {
  const params = new URLSearchParams()
  if (filters?.tourId != null) params.set('tourId', String(filters.tourId))
  if (filters?.from) params.set('from', filters.from)
  if (filters?.to) params.set('to', filters.to)
  if (filters?.status != null) params.set('status', String(filters.status))
  const query = params.toString()
  return authFetch<OrderInfoModel[]>(`api/Order/GetAll${query ? `?${query}` : ''}`, { signal })
}

/** GET one order by id — `OrderDetailPage`. Admin-only, 404s (`OrderNotFound`) for a missing id;
 * left uncaught, same convention as `getUserDetail`. */
export function getOrder(id: number): Promise<OrderInfoModel> {
  return authFetch<OrderInfoModel>(`api/Order/${id}`)
}

/** PATCH `Order/Confirm` — PendingConfirmation → Confirmed (B12, 2026-08-13). Rejects with
 * `errorCode: OrderNotEditable` (2021) if the order is not pending. */
export function confirmOrder(id: number): Promise<void> {
  return authFetch<void>(`api/Order/Confirm?id=${id}`, { method: 'PATCH' })
}

/** PATCH `Order/Cancel` — any non-cancelled order, any status. */
export function cancelOrder(id: number): Promise<void> {
  return authFetch<void>(`api/Order/Cancel?id=${id}`, { method: 'PATCH' })
}

/** PUT `Order/Update` — date/guest count, only while PendingConfirmation. Returns the
 * refreshed order. */
export function updateOrder(model: OrderUpdateModel): Promise<OrderInfoModel> {
  return authFetch<OrderInfoModel>('api/Order/Update', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}
