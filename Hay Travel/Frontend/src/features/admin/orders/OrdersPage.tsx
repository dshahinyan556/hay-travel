import { useMemo, useState } from 'react'
import { redirect, useLoaderData } from 'react-router'
import { InquiryScreenLayout } from '@/shared/ui'
import { AdminScreen, canView, ensurePermissionsReady } from '@/shared/auth'
import { getOrders } from '@/features/admin/api/adminOrders'
import { getAllTours } from '@/features/admin/api/adminTours'
import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { useCopy } from '@/shared/i18n/defineCopy'
import { ordersCopy, STATUS_ORDER } from './lib/ordersCopy'
import { emptyOrderFilters, hasActiveFilters, matchesOrderFilters, type OrderFiltersState } from './lib/ordersModel'
import { OrderRow } from './components/OrderRow'
import { OrderFilters } from './components/OrderFilters'

/**
 * Gated by its OWN key now (`orders`): orders and the calendar used to share one predicate, but
 * they are two independent screens in the permission matrix — "may see the bookings" and "may close
 * dates" are genuinely different jobs.
 *
 * Loads `tours` alongside `orders` for the tour filter's dropdown (same pairing `calendarLoader`
 * does for its own tour picker) — one extra request, but it means the filter never needs a second
 * round trip just to know the tour list. That endpoint is gated by `products.View`, a different
 * key, so it degrades to an empty list rather than 403-ing a screen the role was granted; the
 * filter then simply has no tour options (order rows carry their own titles).
 */
export async function ordersLoader() {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Orders)) throw redirect('/admin')

  const [orders, tours] = await Promise.all([
    getOrders(),
    canView(AdminScreen.Products) ? getAllTours() : Promise.resolve([]),
  ])
  return { orders, tours }
}

type StatusFilter = OrderStatus | 'all'

/**
 * Заказы — the admin's other half of the booking flow. New orders arrive `Open` (or
 * `PendingPayment` when a line requires prepayment) via `OrderCreationService` and stay invisible
 * to the customer as approved until an admin acts on `OrderDetailPage`.
 *
 * A pure index: status tabs + filters narrow the already-loaded `orders` array client-side, and
 * every row is a link. No mutation lives here — this screen never revalidates, so paging through
 * filters never re-fetches.
 *
 * Template D — «Экран просмотра» (`InquiryScreenLayout`), the half of the list↔card pair that
 * only points at records; every action on an order lives on `OrderDetailPage` (template A). The
 * status tabs go in the layout's `controlZone` because that is exactly what the archetype's
 * control zone is for: they change what is SHOWN, never what is stored.
 */
export function OrdersPage() {
  const { orders, tours } = useLoaderData<typeof ordersLoader>()
  const copy = useCopy(ordersCopy)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [filters, setFilters] = useState<OrderFiltersState>(emptyOrderFilters)

  const filterTabs: { id: StatusFilter; label: string }[] = [
    ...STATUS_ORDER.map((status) => ({ id: status as StatusFilter, label: copy.statusLabels[status] })),
    { id: 'all', label: copy.filterAll },
  ]

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
    <InquiryScreenLayout
      title={copy.title}
      subtitle={copy.subtitle}
      controlZone={
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
                    ? 'bg-neutral-950 text-white'
                    : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
                }`}
              >
                {tab.label} <span className="tabular-nums">{count}</span>
              </button>
            )
          })}
        </div>
      }
    >
      <OrderFilters filters={filters} onChange={setFilters} tours={tours} />

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-12 text-center text-sm text-neutral-500">
          {hasActiveFilters(filters) ? copy.emptyFiltered : copy.empty}
        </p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">{copy.ordersUnit(visible.length)}</p>
          <ul className="flex flex-col gap-3">
            {visible.map((order: OrderInfoModel) => (
              <li key={order.id}>
                <OrderRow order={order} />
              </li>
            ))}
          </ul>
        </>
      )}
    </InquiryScreenLayout>
  )
}
