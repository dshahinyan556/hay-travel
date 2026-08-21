import { useMemo, useState } from 'react'
import { redirect, useLoaderData } from 'react-router'
import { canManageCalendar, ensureAuthReady, getAuthState } from '@/shared/auth'
import { getOrders } from '@/features/admin/api/adminOrders'
import { getAllTours } from '@/features/admin/api/adminTours'
import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { ordersCopy, ordersUnit, STATUS_ORDER, statusLabels } from './lib/ordersCopy'
import { emptyOrderFilters, hasActiveFilters, matchesOrderFilters, type OrderFiltersState } from './lib/ordersModel'
import { OrderRow } from './components/OrderRow'
import { OrderFilters } from './components/OrderFilters'

/**
 * Same permission as the calendar (`canManageCalendar`) — orders and availability are the same
 * admin capability domain, unlike catalog/users/settings.
 *
 * Loads `tours` alongside `orders` for the tour filter's dropdown (same pairing `calendarLoader`
 * does for its own tour picker) — one extra request, but it means the filter never needs a second
 * round trip just to know the tour list.
 */
export async function ordersLoader() {
  await ensureAuthReady()
  if (!canManageCalendar(getAuthState().user?.role)) throw redirect('/admin')

  const [orders, tours] = await Promise.all([getOrders(), getAllTours()])
  return { orders, tours }
}

type StatusFilter = OrderStatus | 'all'

const filterTabs: { id: StatusFilter; label: string }[] = [
  ...STATUS_ORDER.map((status) => ({ id: status as StatusFilter, label: statusLabels[status] })),
  { id: 'all', label: ordersCopy.filterAll },
]

/**
 * Заказы — the admin's other half of the booking flow. New orders arrive `Open` (or
 * `PendingPayment` when a line requires prepayment) via `OrderCreationService` and stay invisible
 * to the customer as approved until an admin acts on `OrderDetailPage`.
 *
 * A pure index: status tabs + filters narrow the already-loaded `orders` array client-side, and
 * every row is a link. No mutation lives here — this screen never revalidates, so paging through
 * filters never re-fetches.
 */
export function OrdersPage() {
  const { orders, tours } = useLoaderData<typeof ordersLoader>()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [filters, setFilters] = useState<OrderFiltersState>(emptyOrderFilters)

  const counts = useMemo(() => {
    const byStatus = new Map<OrderStatus, number>()
    for (const order of orders) byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1)
    return byStatus
  }, [orders])

  const visible = useMemo(
    () =>
      orders.filter(
        (o: OrderInfoModel) =>
          (statusFilter === 'all' || o.status === statusFilter) && matchesOrderFilters(o, filters),
      ),
    [orders, statusFilter, filters],
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-neutral-900">{ordersCopy.title}</h1>
        <p className="text-sm text-neutral-500">{ordersCopy.subtitle}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => {
          const count = tab.id === 'all' ? orders.length : (counts.get(tab.id) ?? 0)
          const active = statusFilter === tab.id
          return (
            <button
              key={String(tab.id)}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`min-h-11 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-700 text-white'
                  : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
              }`}
            >
              {tab.label} <span className="tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>

      <OrderFilters filters={filters} onChange={setFilters} tours={tours} />

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-12 text-center text-sm text-neutral-500">
          {hasActiveFilters(filters) ? ordersCopy.emptyFiltered : ordersCopy.empty}
        </p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">{ordersUnit(visible.length)}</p>
          <ul className="flex flex-col gap-3">
            {visible.map((order: OrderInfoModel) => (
              <li key={order.id}>
                <OrderRow order={order} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
