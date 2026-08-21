/**
 * Admin Orders API — `api/Order`.
 *
 * `Order/Create` is the visitor's own action and belongs to `shared/api/booking.ts`;
 * `Order/GetMine` exists server-side but has no UI yet, and a wrapper nobody calls is dead code —
 * add it with the screen that needs it.
 *
 * Every endpoint below except `updateOrder` (owner-or-admin) is `[Authorize(Roles = "Admin")]` —
 * mirrored client-side by `canManageCalendar` (`OrdersPage`'s loader gate).
 */

import { authFetch } from '@/shared/auth'
import { RoleType, type UserInfoModel } from '@/shared/auth'
import type {
  OrderAssignEmployeeModel,
  OrderEventInfoModel,
  OrderInfoModel,
  OrderLineCreateModel,
  OrderLineInfoModel,
  OrderLineUpdateModel,
  OrderPaymentCreateModel,
  OrderPaymentInfoModel,
  OrderStatus,
  OrderStatusUpdateModel,
  OrderUpdateModel,
} from '@/shared/types/booking'
import { getUsers } from './adminUsers'

export interface OrderListFilters {
  tourId?: number
  /** `YYYY-MM-DD`, inclusive. */
  from?: string
  /** `YYYY-MM-DD`, inclusive. */
  to?: string
  status?: OrderStatus
}

/**
 * GET the admin order list. Every filter is optional; tour titles come back in Russian. Filters
 * now match against the order's LINES (a multi-line order matches if any line does), same as the
 * server's own `GetAllAsync` predicate.
 *
 * @param signal optional `AbortSignal` — see `getCalendarMonth`, the two are requested together.
 */
export function getOrders(filters?: OrderListFilters, signal?: AbortSignal): Promise<OrderInfoModel[]> {
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

/** PUT `Order/Update` — date/guest count of the order's own (single) line, only while
 * Open/PendingPayment. Returns the refreshed order. Owner-or-admin, but this admin panel only
 * ever calls it as the admin. */
export function updateOrder(model: OrderUpdateModel): Promise<OrderInfoModel> {
  return authFetch<OrderInfoModel>('api/Order/Update', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** PATCH `Order/SetStatus` — replaces the old Confirm/Cancel pair (ADR 019). Any of the 7 statuses
 * is reachable from any other; `rejectReason` is only persisted when `status === Rejected`. */
export function setOrderStatus(model: OrderStatusUpdateModel): Promise<void> {
  return authFetch<void>('api/Order/SetStatus', {
    method: 'PATCH',
    body: JSON.stringify(model),
  })
}

/** POST `Order/AddLine` — admin adds a line to an existing order (the grid's "+"). Server computes
 * the price/discount snapshot from the tour's CURRENT price, same as a fresh booking would. */
export function addOrderLine(model: OrderLineCreateModel): Promise<OrderLineInfoModel> {
  return authFetch<OrderLineInfoModel>('api/Order/AddLine', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

/** DELETE `Order/RemoveLine` — the grid's "×". Rejects with `errorCode: OrderMustHaveAtLeastOneLine`
 * (2028) on the order's last remaining line — delete the whole order for that instead. */
export function removeOrderLine(lineId: number): Promise<void> {
  return authFetch<void>(`api/Order/RemoveLine?lineId=${lineId}`, { method: 'DELETE' })
}

/** PUT `Order/UpdateLine` — prepayment + fulfillment details ("Детали для выполнения") of one
 * line. Employee assignment is a separate call (`assignEmployee`). */
export function updateOrderLine(model: OrderLineUpdateModel): Promise<void> {
  return authFetch<void>('api/Order/UpdateLine', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** PATCH `Order/AssignEmployee` — "Назначить и отправить": assigns one line (`lineId` set) or
 * every line at once (`lineId: null`, the bulk action), then emails the employee a PDF of the
 * assigned line(s). Rejects with `errorCode: UserIsNotEmployee` (2027) if the target user's role
 * isn't `RoleType.Employee`. */
export function assignEmployee(model: OrderAssignEmployeeModel): Promise<void> {
  return authFetch<void>('api/Order/AssignEmployee', {
    method: 'PATCH',
    body: JSON.stringify(model),
  })
}

/** POST `Order/SendToClient` — emails the customer the whole order as a PDF. */
export function sendOrderToClient(id: number): Promise<void> {
  return authFetch<void>(`api/Order/SendToClient?id=${id}`, { method: 'POST' })
}

/** POST `Order/AddPayment` — a manual ledger entry (prepayment or payment) against one line;
 * there is no payment gateway, the admin records the fact of payment themselves. */
export function addOrderPayment(model: OrderPaymentCreateModel): Promise<OrderPaymentInfoModel> {
  return authFetch<OrderPaymentInfoModel>('api/Order/AddPayment', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

/** GET `Order/{id}/Events` — the "История" tab's readonly audit log, newest first, no pagination.
 * Admin-only; a non-existent order id comes back as `[]` rather than 404 (server convention, see
 * `docs/specs/007-order-event-log-backend.md`). */
export function getOrderEvents(orderId: number): Promise<OrderEventInfoModel[]> {
  return authFetch<OrderEventInfoModel[]>(`api/Order/${orderId}/Events`)
}

/** DELETE `Order/Delete` — removes the order and every line/payment under it. */
export function deleteOrder(id: number): Promise<void> {
  return authFetch<void>(`api/Order/Delete?id=${id}`, { method: 'DELETE' })
}

/** Every account with the `Employee` role — for the assignment `Select`. There is no dedicated
 * "list employees" endpoint: `api/Users` is the same small admin-only list `UsersPage` already
 * loads whole, filtered client-side (same pattern `OrderFilters` uses for tours). */
export async function getEmployees(): Promise<UserInfoModel[]> {
  const users = await getUsers()
  return users.filter((user) => user.role === RoleType.Employee)
}
